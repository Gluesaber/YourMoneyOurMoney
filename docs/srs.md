# YourMoneyOurMoney — Software Requirements Specification (SRS)

> **Document Version:** 1.0.0  
> **Date:** 2026-11-04  
> **Status:** Approved for Sprint 1  
> **Project Theme:** Theme 7 — Personal Money and Expense Logging (CPE 334)  
> **Authors:** Track A (Identity & Administration) & Track B (Ledger & Reporting)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the functional, non-functional, business, and architectural requirements for **YourMoneyOurMoney**, a web-based personal money and expense logging application. This document serves as the authoritative requirements baseline for the entire development lifecycle across Sprint 1, Sprint 2, and Sprint 3.

### 1.2 Scope of the System
**YourMoneyOurMoney** is designed for individuals seeking reliable, transparent personal accounting. The application provides:
- User identity, authentication, and session security.
- Role-based administration and user account governance.
- Multi-category account tracking across Cash (bank accounts, wallets), Liabilities/Debt (credit cards, loans taken), Receivables (loans given), Income categories, and Expense categories.
- Transaction recording (Payment, Receive, Transfer) with multi-line split allocations.
- Real-time dynamic balance and financial summary computations adhering to double-entry bookkeeping principles.
- Search, filtering, favorite transactions, reporting, and data export.

### 1.3 Definitions, Acronyms, and Abbreviations
- **Satang:** The fractional monetary unit of Thailand (1 THB = 100 satang). All internal monetary representation is in integer satang.
- **Split Allocation:** The subdivision of a single financial transaction into multiple line items categorized by distinct expense, income, or debt accounts.
- **FR:** Functional Requirement.
- **BR:** Business Rule.
- **NFR:** Non-Functional Requirement.
- **DL:** Decision Log entry.
- **SDS:** Software Design Specification (`docs/system-sds.md`).

---

## 2. Project Scope and Boundaries

### 2.1 In-Scope Capabilities (Spanning Sprints 1–3)
1. **User Identity & Security:** Registration, credential-based login, secure HTTP-only cookie sessions, logout, and self-profile query.
2. **System Administration:** Administrator user listing, account activation/deactivation, and access barriers prohibiting administrative viewing of personal finances.
3. **Account & Balance Management:** Configuration of Cash, Loan Taken, Loan Given, Income, and Expense accounts; initial opening balance setup with opening dates.
4. **Transaction Logging:** Execution of Payment and Receive operations supporting multi-line allocations, input validation, and transactional atomicity.
5. **Summaries & Visual Dashboard:** Real-time computed net balances, credit card liabilities, receivables, income/expense totals, and category breakdown.
6. **History & Navigation:** Chronological transaction history, transaction detail inspection, filtering by dates/categories, and favorite transaction flags.
7. **Reports & Data Mobility:** Periodic expense/income comparison reports and data export in CSV and JSON formats.

### 2.2 Explicit Exclusions (Out of Scope)
To ensure system integrity, timely delivery, and clear scope containment, the following capabilities are explicitly excluded from the product:
1. **Period / Shared Budgets:** The system does not support period-based budget limits (e.g. monthly category budget caps), envelope budgeting, or multi-user shared budgets / joint accounts. All finances are strictly single-user individual ledgers.
2. **Recurring Transactions:** No automated recurring transaction engine, cron-based auto-billing, or scheduled future auto-posting. All transactions are logged manually by the user.
3. **Direct Bank Integration / Open Banking:** No automated bank account scraping, Open Banking API sync, or automated bank statement parsing (OFX/QIF/CSV sync). All opening balances and transactions are user-entered.
4. **Receipt Media / File Uploads:** No image uploads, receipt photo capture, or document attachments (Multer was intentionally removed from project stack to keep attack surface minimal).
5. **Multi-Currency Support:** All monetary values are strictly in Thai Baht (THB) represented as integer satang. No currency conversion or foreign exchange rates.
6. **Investment & Portfolio Tracking:** No stock, mutual fund, crypto, or asset valuation tracking beyond simple cash/debt balances.

---

## 3. Actors and Persona Matrix

The system recognizes three distinct actors:

### 3.1 User (Standard Authenticated User)
A personal user who manages their private accounts, transactions, and budgets.
- **Permissions:**
  - Authenticate (login, logout, query own identity).
  - Manage own accounts (`CASH`, `LOAN_TAKEN`, `LOAN_GIVEN`, `INCOME`, `EXPENSE`).
  - Set opening balance and opening date on own asset/liability accounts.
  - Record, view, and inspect own transactions with multi-line split allocations.
  - Mark favorite transactions and duplicate transactions.
  - View personal financial summaries, category totals, and history.
- **Restrictions:**
  - Strictly limited to own financial records; cannot read, modify, or infer the existence of another user's accounts or transactions (BR-04).
  - Prohibited from accessing administrator endpoints (`/api/admin/*`) (returns 403 `FORBIDDEN`).
  - If deactivated by an Administrator, the user is barred from logging in (returns 403 `ACCOUNT_DISABLED`), and any existing session is revoked on the next request (returns 401 `UNAUTHENTICATED`) (BR-06).

### 3.2 Administrator (System Governance)
An administrative user responsible for system oversight, user account management, and access governance.
- **Permissions:**
  - Authenticate (login, logout, query own identity).
  - List all registered users in the system (`GET /api/admin/users`).
  - Enable or disable user accounts (`PATCH /api/admin/users/:id`).
- **Restrictions:**
  - **Financial Privacy Barrier:** Strictly prohibited from accessing, viewing, creating, or modifying any user's financial accounts, transactions, balances, or summaries (BR-05). All financial routes return 403 `FORBIDDEN` to administrators, and admin API responses never include financial fields.
  - Prohibited from disabling their own administrator account (`SELF_DISABLE_NOT_ALLOWED` 400) (BR-07).
  - Prohibited from creating or logging personal financial transactions under the administrator account.

### 3.3 Anonymous / Unauthenticated Visitor
A client without an active, valid session cookie.
- **Permissions:**
  - View public landing/login interface.
  - Submit login credentials (`POST /api/auth/login`).
  - Query system health status (`GET /api/health`).
- **Restrictions:**
  - Denied access to all protected user and administrator endpoints (returns 401 `UNAUTHENTICATED`).

### 3.4 Actor Permission Matrix

| Capability | Anonymous | User | Administrator | Enforcing Mechanism |
|---|---|---|---|---|
| Health Check (`GET /api/health`) | Allowed | Allowed | Allowed | Public route |
| User Login (`POST /api/auth/login`) | Allowed | — | — | `auth.routes.ts` |
| User Logout (`POST /api/auth/logout`) | Denied (401) | Allowed | Allowed | `requireUser` |
| View Own Identity (`GET /api/auth/me`) | Denied (401) | Allowed | Allowed | `requireUser` |
| Access Own Financial Data (`/api/accounts`, `/api/transactions`, `/api/summary`) | Denied (401) | Allowed | **Denied (403)** | `requireUser`, `requireRole('USER')`, `assertOwned` |
| Access Another User's Financial Records | Denied (401) | **Denied (404)** | **Denied (403)** | `assertOwned` & Composite FKs `(id, userId)` |
| List System Users (`GET /api/admin/users`) | Denied (401) | Denied (403) | Allowed | `requireUser`, `requireRole('ADMIN')` |
| Toggle User Status (`PATCH /api/admin/users/:id`) | Denied (401) | Denied (403) | Allowed (not self) | `requireUser`, `requireRole('ADMIN')` |
| Disable Own Account | Denied (401) | Denied (403) | **Denied (400)** | Business Rule BR-07 |

---

## 4. Business Rules (BR-01 through BR-13)

The system enforces 13 immutable business rules across the service layer and database schema:

| ID | Rule Statement | Enforcing Layer | Error Code & Status | Rationale |
|---|---|---|---|---|
| **BR-01** | A transaction's allocation lines must sum exactly to its total amount. | Service (`ledger.ts`) | 400 `ALLOCATION_MISMATCH` | Guarantees balanced allocation; prevents mathematical loss or creation of funds across lines. |
| **BR-02** | Total amount and every line amount must be strictly greater than zero (> 0). | Database CHECK constraint & Service | 400 `VALIDATION_ERROR` | Zero or negative amounts are invalid; cancellations or reversals must be handled explicitly. |
| **BR-03** | Money is stored and transmitted as integer satang (THB); no floating-point money anywhere. | Database (`Int`) & API Schemas | 400 `VALIDATION_ERROR` | Prevents binary floating-point roundoff errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). |
| **BR-04** | A User can access only their own accounts, transactions, favorites, and summaries. | Database Composite FKs `(id, userId)` & `assertOwned` | 404 `NOT_FOUND` | Strict multi-tenant isolation. Returning 404 instead of 403 prevents leaking whether an ID exists. |
| **BR-05** | An Administrator cannot read, query, or modify any user's financial data or summaries. | Middleware (`requireRole('USER')`) | 403 `FORBIDDEN` | Absolute financial privacy; administrators manage identities and system flags only. |
| **BR-06** | A disabled user cannot log in, and an existing session stops working on its next request. | Service (`auth.routes.ts`) & Middleware (`auth.ts`) | Login: 403 `ACCOUNT_DISABLED`<br>Session: 401 `UNAUTHENTICATED` | Immediate revocation of access upon administrative account deactivation. |
| **BR-07** | An Administrator cannot disable their own account. | Service (`admin.routes.ts`) | 400 `SELF_DISABLE_NOT_ALLOWED` | Prevents administrative lockout where no active admin remains to govern the system. |
| **BR-08** | Transfers, borrowing, loan repayments, and opening balances are never counted as income or expense. | Service (`ledger.ts`) | Computed Logic | Preserves accounting integrity: asset/liability movements do not reflect true earnings or spend. |
| **BR-09** | Payment source must be `CASH` or `LOAN_TAKEN`; Receive source must be `CASH`. | Service (`ledger.ts`) | 400 `INVALID_ACCOUNT_TYPE` | Payments originate from held funds or credit debt; receipts deposit into held liquid funds. |
| **BR-10** | Allowed line types:<br>• **Payment:** `EXPENSE`, `LOAN_TAKEN`, `LOAN_GIVEN`, `CASH`<br>• **Receive:** `INCOME`, `LOAN_GIVEN`, `LOAN_TAKEN`, `CASH`. | Service (`ledger.ts`) | 400 `INVALID_ACCOUNT_TYPE` | Enforces double-entry classification per transaction flow direction. |
| **BR-11** | The source account cannot appear as one of its own allocation lines. | Service (`ledger.ts`) | 400 `VALIDATION_ERROR` | An account cannot allocate funds to itself within the same transaction. |
| **BR-12** | Only `CASH`, `LOAN_TAKEN`, and `LOAN_GIVEN` accounts have opening balances. | Database CHECK constraint & Service | 400 `INVALID_ACCOUNT_TYPE` | Nominal accounts (`INCOME`, `EXPENSE`) accumulate period transactions only; no initial equity. |
| **BR-13** | A transaction is saved all-or-nothing; a rejected transaction changes no balance. | Database Transaction (`prisma.$transaction`) | Handled via Rollback | Eliminates partial writes or orphaned records upon validation or database failures. |

---

## 5. Functional Requirements (FR)

### 5.1 Authentication and Session Management (FR-AUTH)

#### FR-AUTH-01: User Login
- **Description:** An anonymous user can authenticate by submitting valid username and password credentials.
- **Actor:** Anonymous / Unauthenticated Visitor.
- **Business Rules:** BR-06.
- **Inputs:** `username` (string), `password` (string).
- **Outputs:** HTTP 200 with user profile `{ id, username, role }` and an HTTP-only session cookie `ymom.sid`.
- **Error Handling:**
  - Missing or blank credentials → 400 `VALIDATION_ERROR`.
  - Non-existent user or incorrect password → 401 `INVALID_CREDENTIALS` (timing-neutral, uniform message).
  - Deactivated user (`isEnabled === false`) → 403 `ACCOUNT_DISABLED`.

#### FR-AUTH-02: User Logout
- **Description:** An authenticated user can terminate their active session.
- **Actor:** User, Administrator.
- **Outputs:** HTTP 204 No Content; session record destroyed in PostgreSQL session table and cookie invalidated.
- **Error Handling:** Unauthenticated request → 401 `UNAUTHENTICATED`.

#### FR-AUTH-03: Current User Identity
- **Description:** An authenticated client can retrieve the active user's identity details (`GET /api/auth/me`).
- **Actor:** User, Administrator.
- **Outputs:** HTTP 200 `{ id, username, role }`.
- **Error Handling:** Unauthenticated or expired session → 401 `UNAUTHENTICATED`.

#### FR-AUTH-04: Continuous Session State Verification
- **Description:** On every incoming request to any protected route, the authentication middleware must verify that the session user exists and remains active (`isEnabled === true`).
- **Actor:** System.
- **Business Rules:** BR-06.
- **Error Handling:** If the user account was disabled during an active session, the session is rejected with 401 `UNAUTHENTICATED`.

#### FR-AUTH-05: Session Expiry and Inactivity
- **Description:** Sessions must expire after 24 hours of inactivity. Stored sessions are managed in PostgreSQL via `connect-pg-simple`.
- **Actor:** System.
- **Outputs:** Expired sessions return 401 `UNAUTHENTICATED` upon subsequent requests.

#### FR-AUTH-06: Credential Protection
- **Description:** Passwords must be hashed using `bcryptjs` with a cost factor of at least 10 before storage. Plaintext passwords and password hashes must never be returned in any API response or logged in application logs.
- **Actor:** System.

#### FR-AUTH-07: Password Modification and Account Security (Sprint 3)
- **Description:** An authenticated user or administrator can update their account password by verifying their current password and providing a new valid password (`POST /api/auth/change-password`).
- **Actor:** User, Administrator.
- **Business Rules:** BR-06.
- **Target Sprint:** Sprint 3.
- **Outputs:** HTTP 200 OK.
- **Error Handling:**
  - Incorrect current password → 401 `INVALID_CREDENTIALS`.
  - Non-conforming new password → 400 `VALIDATION_ERROR`.


---

### 5.2 User Administration and Governance (FR-ADM)

#### FR-ADM-01: User Directory Inspection
- **Description:** An Administrator can list all registered users in the system (`GET /api/admin/users`).
- **Actor:** Administrator.
- **Business Rules:** BR-05.
- **Outputs:** HTTP 200 `{ users: [{ id, username, role, isEnabled }] }`.
- **Constraints:** The response must never contain accounts, transactions, balances, or financial summaries.
- **Error Handling:** Invocation by non-admin → 403 `FORBIDDEN`.

#### FR-ADM-02: User Activation and Deactivation
- **Description:** An Administrator can toggle a user account's enabled status (`PATCH /api/admin/users/:id` with `{ isEnabled: boolean }`).
- **Actor:** Administrator.
- **Business Rules:** BR-06, BR-07.
- **Outputs:** HTTP 200 `{ user: { id, username, role, isEnabled } }`.
- **Error Handling:**
  - Target user does not exist → 404 `NOT_FOUND`.
  - Non-boolean `isEnabled` → 400 `VALIDATION_ERROR`.
  - Administrator attempting to disable own account → 400 `SELF_DISABLE_NOT_ALLOWED` (BR-07, see FR-ADM-03).
  - Invocation by non-admin → 403 `FORBIDDEN`.

#### FR-ADM-03: Administrator Self-Disablement Protection
- **Description:** An Administrator is strictly prevented from disabling or deactivating their own administrator account (`PATCH /api/admin/users/:id` where `:id` corresponds to the authenticated administrator).
- **Actor:** Administrator.
- **Business Rules:** BR-07.
- **Outputs:** HTTP 400 with error code `SELF_DISABLE_NOT_ALLOWED`.
- **Rationale:** Guarantees administrative survivability and prevents lockout scenarios where no active administrator exists to govern the system.

#### FR-ADM-04: Financial Boundary Barrier
- **Description:** The system must strictly block administrators from querying or executing any financial endpoint (`/api/accounts`, `/api/transactions`, `/api/summary`). Admin API responses must never contain financial accounts, transactions, or summaries.
- **Actor:** System / Administrator.
- **Business Rules:** BR-05.
- **Outputs:** HTTP 403 `FORBIDDEN`.

---

### 5.3 Account and Opening Balance Management (FR-ACC)

#### FR-ACC-01: Account List Retrieval
- **Description:** A User can retrieve their complete list of financial accounts and categories (`GET /api/accounts`).
- **Actor:** User.
- **Business Rules:** BR-04.
- **Outputs:** HTTP 200 `{ accounts: [{ id, name, type, subtype, openingBalance, openingDate, balance }] }`.
- **Constraints:** Returns only accounts belonging to the authenticated user. Balances are dynamically computed.

#### FR-ACC-02: Account Types and Classification
- **Description:** The system supports five distinct account types and allowable subtypes:
  - `CASH`: Liquid funds held (subtypes: `BANK`, `WALLET`, or null).
  - `LOAN_TAKEN`: Debts owed by the user (subtypes: `CREDIT_CARD` or null).
  - `LOAN_GIVEN`: Money owed to the user (no subtype).
  - `INCOME`: Income categories (no subtype).
  - `EXPENSE`: Expense categories (no subtype).
- **Actor:** User.
- **Constraints:** Subtype must match account type per schema constraints.

#### FR-ACC-03: Unique Account Names
- **Description:** Account names must be unique within a single user's account namespace (composite unique constraint on `(userId, name)`).
- **Actor:** User.

#### FR-ACC-04: Opening Balance Configuration
- **Description:** A User can establish or adjust the opening balance and opening date on their `CASH`, `LOAN_TAKEN`, and `LOAN_GIVEN` accounts (`PUT /api/accounts/:id/opening-balance`).
- **Actor:** User.
- **Business Rules:** BR-03, BR-04, BR-08, BR-12.
- **Inputs:** `openingBalance` (integer satang >= 0), `openingDate` (`YYYY-MM-DD`).
- **Outputs:** HTTP 200 `{ account }`.
- **Error Handling:**
  - Account does not exist or belongs to another user → 404 `NOT_FOUND` (BR-04).
  - Account type is `INCOME` or `EXPENSE` → 400 `INVALID_ACCOUNT_TYPE` (BR-12).
  - Negative opening balance or non-integer satang → 400 `VALIDATION_ERROR`.
  - Malformed date format → 400 `VALIDATION_ERROR`.

#### FR-ACC-05: Non-Income/Expense Opening Balances
- **Description:** The system strictly prevents opening balance amounts from appearing as income or expense in summary calculations.
- **Actor:** System.
- **Business Rules:** BR-08.

#### FR-ACC-06: Custom Account Creation and Management (Sprint 2)
- **Description:** A User can create custom accounts, edit account names/types, and archive accounts with no active transactions.
- **Actor:** User.
- **Business Rules:** BR-03, BR-04, BR-12.
- **Target Sprint:** Sprint 2.

---

### 5.4 Transaction Logging and Split Allocations (FR-TX)

#### FR-TX-01: Payment Transaction Recording
- **Description:** A User can record a `PAYMENT` transaction representing an outflow from liquid funds (`CASH`) or an increase in debt (`LOAN_TAKEN`), allocated across one or more line items.
- **Actor:** User.
- **Business Rules:** BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13.
- **Inputs:** `kind: 'PAYMENT'`, `sourceAccountId` (integer), `date` (`YYYY-MM-DD`), `totalAmount` (integer satang > 0), optional `note` (string), `lines: [{ accountId, amount }]`.
- **Validation Rules:**
  - Source must belong to user and be `CASH` or `LOAN_TAKEN` (BR-09).
  - Lines must be >= 1 item, all amounts > 0 (BR-02).
  - Line accounts must belong to user and have type `EXPENSE`, `LOAN_TAKEN`, `LOAN_GIVEN`, or `CASH` (BR-10).
  - Lines sum must equal `totalAmount` exactly (BR-01).
  - Source cannot appear as an allocation line (BR-11).
- **Outputs:** HTTP 201 `{ transaction: Transaction }`.

#### FR-TX-02: Receive Transaction Recording
- **Description:** A User can record a `RECEIVE` transaction representing an inflow deposited into liquid funds (`CASH`), allocated across one or more line items.
- **Actor:** User.
- **Business Rules:** BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13.
- **Inputs:** `kind: 'RECEIVE'`, `sourceAccountId` (integer), `date` (`YYYY-MM-DD`), `totalAmount` (integer satang > 0), optional `note` (string), `lines: [{ accountId, amount }]`.
- **Validation Rules:**
  - Source must belong to user and be `CASH` (BR-09).
  - Lines must be >= 1 item, all amounts > 0 (BR-02).
  - Line accounts must belong to user and have type `INCOME`, `LOAN_GIVEN`, `LOAN_TAKEN`, or `CASH` (BR-10).
  - Lines sum must equal `totalAmount` exactly (BR-01).
  - Source cannot appear as an allocation line (BR-11).
- **Outputs:** HTTP 201 `{ transaction: Transaction }`.

#### FR-TX-03: Internal Transfer Recording
- **Description:** A User can execute transfers between their own liquid accounts (e.g. Bank to Wallet) via a PAYMENT transaction with a CASH destination line.
- **Actor:** User.
- **Business Rules:** BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13.
- **Inputs:** `kind: 'PAYMENT'`, `sourceAccountId` (integer, `CASH`), `date` (`YYYY-MM-DD`), `totalAmount` (integer satang > 0), optional `note` (string), `lines: [{ accountId, amount }]`.
- **Validation Rules:**
  - Source must belong to user and have type `CASH` (or `LOAN_TAKEN` for credit card debt repayments) (BR-09).
  - Allocation line must belong to user and have type `CASH` (or `LOAN_TAKEN` for credit card debt repayments) (BR-10).
  - Source account cannot appear as an allocation line (BR-11).
  - Lines sum must equal `totalAmount` exactly (BR-01).
- **Outputs:** HTTP 201 `{ transaction: Transaction }`.

#### FR-TX-04: Multi-Line Split Allocation
- **Description:** The system supports splitting any transaction across multiple categories (e.g. a 1,500 THB credit card charge split into 900 THB Dining and 600 THB Groceries).
- **Actor:** User.
- **Business Rules:** BR-01, BR-02.

#### FR-TX-05: Atomic Transaction Persistence
- **Description:** Transaction header and lines are saved together in a single atomic database transaction (`prisma.$transaction`). If any constraint or line insertion fails, the entire transaction rolls back completely with zero effect on balances.
- **Actor:** System.
- **Business Rules:** BR-13.

#### FR-TX-06: Strict Relational Ownership
- **Description:** Database composite foreign keys on `(id, userId)` ensure transactions and transaction lines can only reference accounts owned by the same user.
- **Actor:** System.
- **Business Rules:** BR-04.

#### FR-TX-07: Favorite Transaction Toggle (Sprint 2)
- **Description:** A User can toggle a transaction as a favorite (`isFavorite: boolean`) for quick retrieval.
- **Actor:** User.
- **Business Rules:** BR-04.
- **Target Sprint:** Sprint 2.

#### FR-TX-08: Transaction Duplication (Sprint 2)
- **Description:** A User can duplicate an existing transaction to pre-populate transaction entry forms.
- **Actor:** User.
- **Business Rules:** BR-04.
- **Target Sprint:** Sprint 2.

#### FR-TX-09: Debt and Loan Lifecycle Tracking (Sprint 2)
- **Description:** A User can track loans extended to others (`LOAN_GIVEN`) and debts owed (`LOAN_TAKEN`), logging lending outflows, borrowing inflows, and partial or full repayments that adjust outstanding balances without affecting income or expense totals.
- **Actor:** User.
- **Business Rules:** BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13.
- **Target Sprint:** Sprint 2.

#### FR-TX-10: Transaction Modification and Voiding (Sprint 3)
- **Description:** A User can edit transaction metadata and allocation lines (`PUT /api/transactions/:id`) or void/delete a transaction (`DELETE /api/transactions/:id`) with atomic balance recalculation and validation rollback.
- **Actor:** User.
- **Business Rules:** BR-01, BR-02, BR-04, BR-11, BR-13.
- **Target Sprint:** Sprint 3.


---

### 5.5 Summaries, Balances, and Reporting (FR-SUM)

#### FR-SUM-01: Dynamic Balance Calculation
- **Description:** The balance of any account is computed dynamically from its opening balance plus the sum of transaction source effects and line effects. Balances are never stored as mutable columns.
- **Actor:** System.
- **Business Rules:** BR-03, BR-04, BR-08.
- **Balance Formulas:**
  - `balance(CASH) = openingBalance - Σ(Payment sources) + Σ(Receive sources) + Σ(Payment lines) - Σ(Receive lines)`
  - `balance(LOAN_TAKEN) = openingBalance + Σ(Payment sources) - Σ(Payment lines) + Σ(Receive lines)`
  - `balance(LOAN_GIVEN) = openingBalance + Σ(Payment lines) - Σ(Receive lines)`
  - `balance(INCOME) = Σ(Receive lines)`
  - `balance(EXPENSE) = Σ(Payment lines)`

#### FR-SUM-02: Consolidated Financial Summary
- **Description:** A User can query their real-time financial summary overview (`GET /api/summary`).
- **Actor:** User.
- **Business Rules:** BR-04, BR-05, BR-08.
- **Outputs:** HTTP 200:
  ```json
  {
    "cash": [{ "accountId": 1, "name": "Bank", "balance": 3850000 }],
    "loansTaken": [{ "accountId": 2, "name": "Credit Card", "outstanding": 0 }],
    "loansGiven": [],
    "totals": { "income": 3000000, "expense": 150000 },
    "income": [{ "accountId": 3, "name": "Salary", "total": 3000000 }],
    "expense": [
      { "accountId": 7, "name": "Dining", "total": 90000 },
      { "accountId": 8, "name": "Groceries", "total": 60000 }
    ]
  }
  ```

#### FR-SUM-03: Strict Accounting Exclusion
- **Description:** Summary calculations must never include transfers, loans, repayments, or opening balances in the `totals.income` or `totals.expense` amounts.
- **Actor:** System.
- **Business Rules:** BR-08.
- **Constraints:**
  - `totals.income` is strictly computed as `Σ(Receive lines on INCOME accounts)`.
  - `totals.expense` is strictly computed as `Σ(Payment lines on EXPENSE accounts)`.
  - Fund movements between cash accounts, debt borrowings, loan repayments, and initial equity opening balances are excluded from income and expense summaries.

#### FR-SUM-04: Periodic Financial Analytics & Charts (Sprint 3)
- **Description:** Users can view graphical visualizations and monthly comparative expense/income breakdowns.
- **Actor:** User.
- **Business Rules:** BR-03, BR-04, BR-08.
- **Target Sprint:** Sprint 3.

---

### 5.6 History, Filtering, and Data Mobility (FR-HST)

#### FR-HST-01: Transaction History Feed
- **Description:** A User can view their chronological transaction history (`GET /api/transactions`), sorted by newest `date` descending, then newest `id` descending.
- **Actor:** User.
- **Business Rules:** BR-04.
- **Outputs:** HTTP 200 `{ transactions: Transaction[] }` including transaction kind, date, total amount, note, favorite status, source account, and lines.

#### FR-HST-02: Transaction Detail View
- **Description:** A User can retrieve the complete details of an individual transaction (`GET /api/transactions/:id`).
- **Actor:** User.
- **Business Rules:** BR-04.
- **Outputs:** HTTP 200 `{ transaction: Transaction }`.
- **Error Handling:** Transaction not found or owned by another user → 404 `NOT_FOUND`.

#### FR-HST-03: Transaction History Filtering and Search (Sprint 2)
- **Description:** A User can filter transactions by date ranges, account, category, or search keywords within notes.
- **Actor:** User.
- **Business Rules:** BR-04.
- **Target Sprint:** Sprint 2.

#### FR-HST-04: Data Export in CSV and JSON Formats (Sprint 3)
- **Description:** A User can export their transaction records and summary balances in CSV and JSON formats for offline archiving.
- **Actor:** User.
- **Business Rules:** BR-03, BR-04.
- **Target Sprint:** Sprint 3.

---

### 5.7 System Infrastructure and Health (FR-SYS)

#### FR-SYS-01: Standardized Error Envelope
- **Description:** All error responses across all API endpoints return a uniform JSON error payload:
  `{ "error": { "code": string, "message": string, "details"?: any } }` with appropriate HTTP status codes.
- **Actor:** System.

#### FR-SYS-02: Health Check
- **Description:** The system exposes a public health probe endpoint (`GET /api/health`) returning operational status for container orchestrators and monitoring.
- **Actor:** Anonymous / System.
- **Outputs:** HTTP 200 `{ "status": "ok" }`.

---

## 6. Measurable Non-Functional Requirements (NFR)

### 6.1 Security Requirements

- **NFR-SEC-01 (Password Hashing):** All user passwords must be hashed using `bcryptjs` with a work factor (salt rounds) >= 10. Passwords must never be stored in plaintext, logged, or returned in any API response.
- **NFR-SEC-02 (Session Security):** Sessions must be managed server-side in PostgreSQL using `connect-pg-simple`. Session cookies (`ymom.sid`) must be configured with `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` in production environments.
- **NFR-SEC-03 (Data Isolation & Anti-Enumeration):** Cross-tenant data access attempts must return 404 `NOT_FOUND` rather than 403 `FORBIDDEN`, ensuring unauthorized actors cannot determine the existence of resources owned by other users.
- **NFR-SEC-04 (Role-Based Access Enforcement):** Authorization checks must be enforced at the middleware layer before route handlers execute. Financial routes require `role === 'USER'`; administration routes require `role === 'ADMIN'`.

### 6.2 Performance and Scalability

- **NFR-PERF-01 (API Response Latency):** Under standard load conditions (up to 50 concurrent requests on a single server instance):
  - Read queries (`GET /api/accounts`, `GET /api/transactions`, `GET /api/summary`) must have p95 response times < 200 ms.
  - Transaction creation (`POST /api/transactions`) must have p95 response times < 250 ms.
  - Authentication requests (`POST /api/auth/login`) must complete within 200–500 ms (bounded by intentional bcrypt work factor).
- **NFR-PERF-02 (Database Query Efficiency):** Composite foreign keys and indexes on `(userId, name)`, `(userId, date)`, and `(transactionId, accountId)` must ensure query execution times remain < 50 ms for datasets up to 100,000 transactions.

### 6.3 Reliability and Data Persistence

- **NFR-REL-01 (Data Persistence Across Restarts):** All financial data, user profiles, and active sessions must persist across application server crashes, container reboots, and database restarts via PostgreSQL disk-backed storage.
- **NFR-REL-02 (Atomicity & Zero Partial State):** 100% of multi-line transaction writes must be atomic. In the event of system crash, connection failure, or validation abort during save, zero partial records or unallocated balances may persist (BR-13).
- **NFR-REL-03 (Zero Floating-Point Drift):** The system must maintain 100% mathematical precision down to exactly 1 satang (0.01 THB) across all calculations and conversions.

### 6.4 Usability and Compatibility

- **NFR-COMP-01 (Cross-Browser Compatibility):** The client interface must render correctly and operate without functional degradation on modern evergreen browsers: Google Chrome 120+, Mozilla Firefox 120+, Apple Safari 17+, and Microsoft Edge 120+.
- **NFR-COMP-02 (Responsive Viewport Support):** The client user interface must be fully functional across display viewports from mobile smartphones (minimum width 360px) to standard desktop displays (1920x1080px).
- **NFR-COMP-03 (Localized Currency Presentation):** Users must input and view amounts in standard Thai Baht format (e.g. `1,500.00 THB`), while client-side utilities convert accurately to/from integer satang (`150000`).

### 6.5 Maintainability and Code Quality

- **NFR-MAINT-01 (Type Safety & Static Analysis):** Server and client codebases must adhere to TypeScript strict mode with zero compilation errors, zero ESLint errors, and zero Prettier style deviations.
- **NFR-MAINT-02 (Automated Test Coverage):** Core business rules (BR-01 through BR-13) must be verified by automated unit tests and integration tests with 100% test pass rate in CI.

---

## 7. Assumptions and Dependencies

### 7.1 Assumptions
1. **Primary Currency:** All personal financial activities occur in Thai Baht (THB).
2. **Monetary Limits:** The 32-bit signed integer range used for satang (`Int` in Prisma/PostgreSQL) accommodates up to 2,147,483,647 satang (≈ 21.47 million THB) per line item, which is fully sufficient for personal expense tracking.
3. **Date Uniformity:** Financial transactions are recorded with calendar date specificity (`YYYY-MM-DD`). Time-of-day and timezone conversions do not shift transaction dates.
4. **Single-Tenant Database per Deployment:** The application operates against a single PostgreSQL database instance with standard connection pooling.

### 7.2 Dependencies
- **Node.js Runtime:** Node.js version 22 or newer.
- **Relational Database:** PostgreSQL 16 managed via Docker or managed cloud PostgreSQL.
- **ORM & Migrations:** Prisma ORM 5.x.
- **Session Store:** `connect-pg-simple` writing to the `session` table.
- **Client Bundler:** Vite with React 18, React Router v6, and Bootstrap 5.

---

## 8. Architectural Decision Log

| ID | Topic | Decision | Rationale | Alternatives Considered |
|---|---|---|---|---|
| **DL-01** | Monetary Representation | Use integer satang (1 THB = 100 satang) in database and API payloads. | Completely eliminates binary floating-point rounding errors and precision loss (BR-03). | Floating-point `Float` (rejected due to precision drift); `Decimal` strings (rejected for unnecessary overhead in personal finance). |
| **DL-02** | Account Balance Calculation | Compute balances dynamically on-read from opening balance and transaction lines. | Prevents ledger synchronization drift, eliminates cache invalidation race conditions, and guarantees mathematical correctness. | Cached balance column on `Account` (rejected due to race condition risks in concurrent writes). |
| **DL-03** | Session Management | Server-side sessions in PostgreSQL using `express-session` and `connect-pg-simple`. | Enables instantaneous session revocation when an administrator disables an account (BR-06); prevents token theft via XSS. | Stateless JWT in `localStorage` (rejected: cannot immediately revoke disabled users without complex blacklists). |
| **DL-04** | Multi-Tenant Data Isolation | Composite Foreign Keys `(id, userId)` on transactions and lines, coupled with `assertOwned` helper. | Guarantees at the database schema level that a user cannot reference another user's accounts, even in the event of an application bug. | Single-column FKs with application-only checks (rejected: leaves database vulnerable to logic bugs). |
| **DL-05** | Unauthorized Resource Responses | Return HTTP 404 `NOT_FOUND` when attempting to access another user's records. | Prevents resource enumeration and existence discovery attacks across users. | HTTP 403 `FORBIDDEN` (rejected: reveals that an ID exists in the system). |
| **DL-06** | Administrator Financial Privacy Barrier | Block administrators from accessing financial endpoints with HTTP 403 `FORBIDDEN`. Admin APIs never return financial data. | Protects personal privacy; system administration is strictly separated from financial ledger inspection (BR-05). | Allowing admin read-only access (rejected: violates core personal privacy requirement). |
| **DL-07** | Split Transaction Structure | Header-line model (`Transaction` with 1..n `TransactionLine`s) executed in a single atomic transaction. | Accurately models real-world split receipts while maintaining strict atomic balance validation (BR-01, BR-13). | Separate independent single transactions (rejected: loses split receipt context and atomicity). |
| **DL-08** | Elimination of File Uploads | Drop file/receipt image uploads and remove Multer dependency from stack. | Simplifies deployment, minimizes disk/cloud storage complexity, and shrinks security attack surface. | Local disk upload via Multer (rejected: stateful container dependencies). |

---

## 9. Theme 7 Brief Item Compliance Mapping

Every requirement and guideline from the **Theme 7 (Personal Money and Expense Logging)** project brief is mapped to either a Functional Requirement or an Explicit Exclusion below:

| Theme 7 Brief Item | Requirement Summary | Status | Mapped Item / Justification |
|---|---|---|---|
| **T7-01: User Accounts & Auth** | Personal user login, logout, password security | In Scope | FR-AUTH-01 through FR-AUTH-07, NFR-SEC-01 |
| **T7-02: Multi-Role Access** | User vs Admin separation; admin governance | In Scope | FR-ADM-01 through FR-ADM-04, BR-05, BR-07 |
| **T7-03: Financial Accounts** | Cash, Bank, Wallet, Credit Card, Loans, Categories | In Scope | FR-ACC-01 through FR-ACC-03, FR-ACC-06, BR-03, BR-04, BR-09, BR-10, BR-12 |
| **T7-04: Opening Balances** | Initial account setup with opening dates | In Scope | FR-ACC-04, FR-ACC-05, BR-08, BR-12 |
| **T7-05: Transaction Logging** | Payment, Receive, and Transfer operations | In Scope | FR-TX-01 through FR-TX-03, FR-TX-05, FR-TX-06, FR-TX-09, FR-TX-10, BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13 |
| **T7-06: Split Allocations** | Split bills across multiple categories/accounts | In Scope | FR-TX-04, BR-01, BR-02 |
| **T7-07: Real-Time Balances** | Running cash balances, debt tracking, receivables | In Scope | FR-SUM-01 through FR-SUM-03, BR-03, BR-04, BR-05, BR-08 |
| **T7-08: Transaction History** | Reverse chronological history, transaction inspection | In Scope | FR-HST-01, FR-HST-02 |
| **T7-09: Filtering & Favorites** | Quick search, category filters, favorite flags | In Scope | FR-HST-03, FR-TX-07, FR-TX-08 (Sprint 2) |
| **T7-10: Reports & Analytics** | Monthly breakdown, income vs expense comparison | In Scope | FR-SUM-04 (Sprint 3) |
| **T7-11: Data Export** | CSV / JSON export of transactions and balances | In Scope | FR-HST-04 (Sprint 3) |
| **T7-12: Envelope / Period Budgets** | Category spending caps and family shared budgets | **Excluded** | Explicit Exclusion §2.2 Item 1 (Personal single-user focus) |
| **T7-13: Automated Recurring Tx** | Automatic scheduled recurring posting | **Excluded** | Explicit Exclusion §2.2 Item 2 (Manual logging integrity) |
| **T7-14: Bank Direct Integration** | Open banking sync, automated bank feeds | **Excluded** | Explicit Exclusion §2.2 Item 3 (Self-contained security) |
| **T7-15: Receipt Photo Upload** | Uploading receipt photos or file attachments | **Excluded** | Explicit Exclusion §2.2 Item 4 (Multer dropped from stack) |
| **T7-16: Foreign Currencies** | Multi-currency conversions and FX rates | **Excluded** | Explicit Exclusion §2.2 Item 5 (THB satang base currency) |
