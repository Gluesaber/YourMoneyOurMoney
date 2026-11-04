# YourMoneyOurMoney — Whole-Product Feature Inventory

> **Document Version:** 1.0.0  
> **Date:** 2026-11-04  
> **Status:** Draft  
> **Product Scope:** Sprint 1, Sprint 2, and Sprint 3  
> **Theme:** Theme 7 — Personal Money and Expense Logging (CPE 334)

This document provides a comprehensive inventory of all product features across the three planned sprints. Features are identified by unique IDs (`F-01` through `F-14`) and mapped to specific sprints, functional requirements, and track owners.

---

## 1. Feature Roadmap & Sprint Allocation

| Feature ID | Feature Name | Target Sprint | Track / Owner | Status | Core Capability |
|---|---|---|---|---|---|
| **F-01** | User Authentication & Session Management | **Sprint 1** | Track A | In Progress | Secure login, session persistence, logout, auth context |
| **F-02** | Administrator User Management | **Sprint 1** | Track A | In Progress | User listing, enable/disable accounts, self-disable protection |
| **F-03** | Account Setup & Opening Balances | **Sprint 1** | Track B | In Progress | Seeded accounts (Bank, Card, Categories), opening balances |
| **F-04** | Transaction Recording & Split Allocations | **Sprint 1** | Track B | In Progress | Payment/Receive entry, multi-line splits, balance validation |
| **F-05** | Financial Summary & Transaction History | **Sprint 1** | Track B | In Progress | Real-time balances, debt tracking, category totals, history list |
| **F-06** | Custom Account & Category Management | **Sprint 2** | Decided at sprint planning | Planned | Create, edit, and archive custom accounts and categories |
| **F-07** | Internal Account Transfers | **Sprint 2** | Decided at sprint planning | Planned | Dedicated UI for inter-account cash transfers |
| **F-08** | Debt & Receivable Lifecycle (Lending & Borrowing) | **Sprint 2** | Decided at sprint planning | Planned | Loan given / loan taken tracking, repayments, outstanding debts |
| **F-09** | Transaction Search, Filtering & Sorting | **Sprint 2** | Decided at sprint planning | Planned | Date range filtering, category search, keyword matching (`q`) |
| **F-10** | Favorite & Duplicate Transactions | **Sprint 2** | Decided at sprint planning | Planned | Quick re-entry, star and view favorite transactions, clone records |
| **F-11** | Financial Reports & Periodic Spending Analytics [Added by Team] | **Sprint 3** | Decided at sprint planning | Planned | Monthly income vs expense charts, category spend trends (DL-09) |
| **F-12** | Transaction Editing, Voiding & Audit Corrections | **Sprint 3** | Decided at sprint planning | Planned | Revise transaction notes/lines, void transactions with rollback |
| **F-13** | Data Export (CSV & JSON) [Added by Team] | **Sprint 3** | Decided at sprint planning | Planned | Export transaction ledgers and account statements (DL-09) |
| **F-14** | User Profile & Security Settings [Added by Team] | **Sprint 3** | Decided at sprint planning | Planned | Change password, user creation governance (DL-09) |

---

## 2. Sprint 1 Features (Core Foundations & Demo Journey)

### F-01: User Authentication & Session Management
- **Target Sprint:** Sprint 1
- **Track Owner:** Track A (Identity & Administration)
- **Status:** In Progress (S1-04 contract, S1-05/S1-06 backend, S1-08 frontend)
- **User Story:**  
  *As a personal user or administrator, I want to securely log in with my username and password, maintain an active session, and log out when finished, so that my account and private data are protected.*
- **Detailed Capabilities:**
  - Authenticate against stored `User` records with `bcryptjs` password verification.
  - Issue HTTP-only, SameSite=Lax session cookie (`ymom.sid`) backed by PostgreSQL `connect-pg-simple`.
  - Provide `GET /api/auth/me` to restore client authentication state on page refresh.
  - Enforce immediate session revocation if an administrator disables the account (BR-06).
  - Destroy server-side session and expire client cookie upon logout.
- **Mapped FRs:** FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-AUTH-06.
- **Mapped BRs:** BR-06.
- **API Endpoints:**
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- **UI Components:** `LoginPage`, `Layout` (navbar auth state & logout button), `AuthContext`, `RequireRole`.
- **Dependencies:** S1-01 (scaffold & test harness), S1-02 (API map & schema).

---

### F-02: Administrator User Management
- **Target Sprint:** Sprint 1
- **Track Owner:** Track A (Identity & Administration)
- **Status:** In Progress (S1-04 contract, S1-07 backend, S1-08 frontend)
- **User Story:**  
  *As an administrator, I want to view all registered users and toggle their active/disabled status, so that I can govern platform access while maintaining complete separation from users' private financial data.*
- **Detailed Capabilities:**
  - List all system users with their ID, username, role, and enabled status.
  - Enable or disable user accounts via `PATCH /api/admin/users/:id`.
  - Prevent administrator self-disablement with error `SELF_DISABLE_NOT_ALLOWED` (BR-07).
  - Strictly enforce financial privacy: admin endpoints return zero financial data, and admins are blocked from calling financial endpoints (BR-05).
- **Mapped FRs:** FR-ADM-01, FR-ADM-02, FR-ADM-03, FR-ADM-04.
- **Mapped BRs:** BR-05, BR-06, BR-07.
- **API Endpoints:**
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id`
- **UI Components:** `AdminUsersPage`, user status toggle controls.
- **Dependencies:** S1-05 (auth), S1-06 (access control middleware).

---

### F-03: Account Setup & Opening Balances
- **Target Sprint:** Sprint 1
- **Track Owner:** Track B (Ledger & Reporting)
- **Status:** In Progress (S1-10 contract, S1-11 backend, S1-14 frontend)
- **User Story:**  
  *As a personal user, I want to view my pre-seeded financial accounts and configure opening balances and dates for my bank and credit card, so that my ledger accurately reflects my starting financial position.*
- **Detailed Capabilities:**
  - Automatically provide default seeded accounts per user: Bank (`CASH`/`BANK`), Credit Card (`LOAN_TAKEN`/`CREDIT_CARD`), Income categories (`Salary`, `Interest`), Expense categories (`Dining`, `Groceries`, `Electricity`, `Telecom`).
  - Retrieve own accounts list with dynamically computed balances (`GET /api/accounts`).
  - Configure opening balance (integer satang) and opening date (`YYYY-MM-DD`) on `CASH`, `LOAN_TAKEN`, or `LOAN_GIVEN` accounts (`PUT /api/accounts/:id/opening-balance`).
  - Strictly prohibit setting opening balances on `INCOME` or `EXPENSE` categories (BR-12).
  - Exclude opening balance amounts from income and expense summaries (BR-08).
- **Mapped FRs:** FR-ACC-01, FR-ACC-02, FR-ACC-03, FR-ACC-04, FR-ACC-05.
- **Mapped BRs:** BR-03, BR-04, BR-08, BR-12.
- **API Endpoints:**
  - `GET /api/accounts`
  - `PUT /api/accounts/:id/opening-balance`
- **UI Components:** `OpeningBalanceModal` / form on `DashboardPage`.
- **Dependencies:** S1-01, S1-02, S1-10 (contracts).

---

### F-04: Transaction Recording & Split Allocations
- **Target Sprint:** Sprint 1
- **Track Owner:** Track B (Ledger & Reporting)
- **Status:** In Progress (S1-10 contract, S1-12 backend, S1-14 frontend)
- **User Story:**  
  *As a personal user, I want to record Payment and Receive transactions split across one or more allocation lines with automatic balance validation, so that my expenditures and incomes are accurately categorized.*
- **Detailed Capabilities:**
  - Record `PAYMENT` transaction with source `CASH` or `LOAN_TAKEN` (BR-09).
  - Record `RECEIVE` transaction with source `CASH` (BR-09).
  - Allocate total amount across multiple category lines with positive amounts (BR-02).
  - Enforce line types per transaction kind (BR-10).
  - Prevent using the source account as an allocation line (BR-11).
  - Validate that the sum of line amounts exactly equals the total amount (`ALLOCATION_MISMATCH` 400) (BR-01).
  - Atomic persistence in a single database transaction (`prisma.$transaction`) (BR-13).
  - Enforce ownership on all involved accounts (BR-04).
- **Mapped FRs:** FR-TX-01, FR-TX-02, FR-TX-04, FR-TX-05, FR-TX-06.
- **Mapped BRs:** BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13.
- **API Endpoints:**
  - `POST /api/transactions`
- **UI Components:** `TransactionFormPage`, `AllocationLineEditor`, live "Remaining to allocate" balance calculator.
- **Dependencies:** S1-11 (accounts), S1-10 (contracts).

---

### F-05: Financial Summary & Transaction History
- **Target Sprint:** Sprint 1
- **Track Owner:** Track B (Ledger & Reporting)
- **Status:** In Progress (S1-10 contract, S1-13 backend, S1-14 frontend)
- **User Story:**  
  *As a personal user, I want to see a consolidated dashboard with my bank balance, credit card debt, total income/expense, and a chronological history of my transactions, so that I have a clear view of my finances.*
- **Detailed Capabilities:**
  - Calculate real-time net liquid balances for `CASH` accounts.
  - Calculate outstanding debt for `LOAN_TAKEN` accounts.
  - Calculate totals for `INCOME` and `EXPENSE` categories, excluding non-income/expense movements (BR-08).
  - Retrieve chronological transaction list (`GET /api/transactions`) ordered newest date first, then newest ID first.
  - Retrieve transaction detail (`GET /api/transactions/:id`) with source account and breakdown lines.
- **Mapped FRs:** FR-SUM-01, FR-SUM-02, FR-SUM-03, FR-HST-01, FR-HST-02.
- **Mapped BRs:** BR-03, BR-04, BR-05, BR-08.
- **API Endpoints:**
  - `GET /api/summary`
  - `GET /api/transactions`
  - `GET /api/transactions/:id`
- **UI Components:** `DashboardPage`, `SummaryCard`, `TransactionListPage`, `TransactionDetailPage`.
- **Dependencies:** S1-12 (transactions).

---

## 3. Sprint 2 Features (Lifecycle Expansion & Workflow Usability)

### F-06: Custom Account & Category Management
- **Target Sprint:** Sprint 2
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to create custom bank accounts, e-wallets, and customized income and expense categories, so that the system fits my specific personal spending habits.*
- **Detailed Capabilities:**
  - Create new accounts specifying name, type, and subtype (`POST /api/accounts`).
  - Validate unique account names per user namespace (`(userId, name)`).
  - Edit account names and update opening balances; account type changes are strictly prohibited once transactions exist for the account (`CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS`) to avoid ledger corruption.
  - Archive or delete unused accounts (restricted if transactions reference the account via foreign key constraints).
- **Mapped FRs:** FR-ACC-02, FR-ACC-03, FR-ACC-04, FR-ACC-06.
- **Mapped BRs:** BR-03, BR-04, BR-12.
- **API Endpoints:**
  - `POST /api/accounts`
  - `PATCH /api/accounts/:id`
  - `DELETE /api/accounts/:id`
- **UI Components:** `AccountManagementPage`, `CreateAccountModal`.
- **Dependencies:** F-03 (Account Setup).

---

### F-07: Internal Account Transfers
- **Target Sprint:** Sprint 2
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want a dedicated transfer workflow between my liquid accounts (e.g. Bank to Cash Wallet), so that inter-account fund shifts are seamless, clearly logged, and excluded from income/expense summaries.*
- **Detailed Capabilities:**
  - Specialized Transfer UI pre-populating source and destination `CASH` accounts.
  - Support transfers logged via Payment (source: CASH, line: CASH) or Receive (source: CASH, line: CASH).
  - Automatically enforce non-income/expense classification (BR-08).
  - Immediate dynamic balance updates across both cash accounts.
  *(Note: Debt repayments involving `LOAN_TAKEN` accounts are handled in F-08 / FR-TX-09, not internal cash transfers).*
- **Mapped FRs:** FR-TX-03, FR-SUM-03.
- **Mapped BRs:** BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13.
- **API Endpoints:** `POST /api/transactions` (kind: PAYMENT | RECEIVE, source: CASH, line: CASH).
- **UI Components:** `TransferFormPage`.
- **Dependencies:** F-04, F-05.

---

### F-08: Debt & Receivable Lifecycle (Lending & Borrowing)
- **Target Sprint:** Sprint 2
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to log loans I have extended to friends (receivables) and loans I have borrowed (debts), and log partial or full repayments, so that I can keep track of outstanding personal balances.*
- **Detailed Capabilities:**
  - Support `LOAN_GIVEN` accounts for tracking money lent to others.
  - Support non-credit-card `LOAN_TAKEN` accounts for tracking personal borrowing.
  - Record lending payments (increases `LOAN_GIVEN` receivable).
  - Record borrowing receives (increases `LOAN_TAKEN` liability and `CASH` holding).
  - Record debt repayments received or made, reducing outstanding balances without affecting income or expense totals (BR-08).
- **Mapped FRs:** FR-TX-09, FR-ACC-02, FR-TX-01, FR-TX-02, FR-SUM-01.
- **Mapped BRs:** BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13.
- **API Endpoints:** `GET /api/summary` (loansGiven & loansTaken sections), `POST /api/transactions`.
- **UI Components:** `LoansOverviewPage`, `LendingRepaymentModal`.
- **Dependencies:** F-04, F-05.

---

### F-09: Transaction Search, Filtering & Sorting
- **Target Sprint:** Sprint 2
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to search and filter my transaction history by date range, account, category, and keyword, so that I can quickly locate specific transactions.*
- **Detailed Capabilities:**
  - Query parameters on `GET /api/transactions`: `startDate`, `endDate`, `accountId`, `kind`, `q`.
  - Case-insensitive substring search across transaction notes.
  - Client-side quick filter buttons (This Month, Last Month, This Year).
- **Mapped FRs:** FR-HST-03.
- **Mapped BRs:** BR-04.
- **API Endpoints:** `GET /api/transactions?startDate=...&endDate=...&accountId=...&q=...`.
- **UI Components:** `TransactionFilterBar`, `DateRangePicker`.
- **Dependencies:** F-05.

---

### F-10: Favorite & Duplicate Transactions
- **Target Sprint:** Sprint 2
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to star frequent transactions as favorites and duplicate past transactions with one click, so that recurring manual entries (like monthly bills) take minimal time to log.*
- **Detailed Capabilities:**
  - Toggle `isFavorite` on transactions (`PATCH /api/transactions/:id/favorite`).
  - Quick-action "Duplicate" button in transaction list that copies source, categories, and amounts into the transaction form for the current date.
  - Dedicated "Favorites" tab or dashboard widget for rapid 1-click recording.
- **Mapped FRs:** FR-TX-07, FR-TX-08.
- **Mapped BRs:** BR-04.
- **API Endpoints:**
  - `PATCH /api/transactions/:id/favorite`
  - `GET /api/transactions/favorites`
- **UI Components:** `FavoriteStarToggle`, `DuplicateTransactionButton`, `QuickExpenseWidget`.
- **Dependencies:** F-04, F-05.

---

## 4. Sprint 3 Features (Analytics, Audit & Maintenance)

### F-11: Financial Reports & Periodic Spending Analytics [Added by Team]
- **Target Sprint:** Sprint 3
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to view monthly expense versus income breakdown charts and category trends, so that I understand my financial habits over time.*
- **Detailed Capabilities:**
  - Aggregated monthly totals for income and expense over the trailing 12 months.
  - Breakdown pie/bar charts showing top spending categories.
  - Average daily spend calculations.
- **Mapped FRs:** FR-SUM-04.
- **Mapped BRs:** BR-03, BR-04, BR-08.
- **API Endpoints:**
  - `GET /api/reports/monthly`
  - `GET /api/reports/category-breakdown`
- **UI Components:** `ReportsPage`, `MonthlyBarChart`, `CategoryPieChart`.
- **Dependencies:** F-05, F-09.

---

### F-12: Transaction Editing, Voiding & Audit Corrections
- **Target Sprint:** Sprint 3
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to edit mistakes in transaction notes/dates or void a wrongly entered transaction, so that my account balances stay accurate if I make an entry error.*
- **Detailed Capabilities:**
  - Update transaction date, note, and allocation lines (`PUT /api/transactions/:id`).
  - Full atomic validation on edited lines (BR-01, BR-02, BR-09, BR-10, BR-11).
  - Void/delete a transaction (`DELETE /api/transactions/:id`), immediately recalculating dynamic balances.
- **Mapped FRs:** FR-TX-10, FR-TX-01, FR-TX-02, FR-TX-05.
- **Mapped BRs:** BR-01, BR-02, BR-04, BR-11, BR-13.
- **API Endpoints:**
  - `PUT /api/transactions/:id`
  - `DELETE /api/transactions/:id`
- **UI Components:** `EditTransactionModal`, `DeleteTransactionConfirmModal`.
- **Dependencies:** F-04, F-05.

---

### F-13: Data Export (CSV & JSON) [Added by Team]
- **Target Sprint:** Sprint 3
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a personal user, I want to export my transaction records and account balances as CSV or JSON files, so that I can backup my data or inspect it in spreadsheet software.*
- **Detailed Capabilities:**
  - Export filtered transaction history to RFC 4180 compliant CSV.
  - Export complete user financial backup as structured JSON.
  - Monetary values exported in both standard THB decimal format and integer satang.
- **Mapped FRs:** FR-HST-04.
- **Mapped BRs:** BR-03, BR-04.
- **API Endpoints:**
  - `GET /api/export/transactions.csv`
  - `GET /api/export/backup.json`
- **UI Components:** `ExportModal`, `DownloadCsvButton`.
- **Dependencies:** F-05, F-09.

---

### F-14: User Profile & Security Settings [Added by Team]
- **Target Sprint:** Sprint 3
- **Track Owner:** Decided at sprint planning
- **Status:** Planned
- **User Story:**  
  *As a user or administrator, I want to change my password and view my active session details, so that I can maintain my account security.*
- **Detailed Capabilities:**
  - Password update endpoint (`POST /api/auth/change-password`) verifying existing password and hashing new password with `bcryptjs`.
  - Revoke other active sessions upon password reset.
- **Mapped FRs:** FR-AUTH-07, FR-AUTH-06.
- **Mapped BRs:** BR-06.
- **API Endpoints:**
  - `POST /api/auth/change-password`
- **UI Components:** `ProfileSettingsPage`, `ChangePasswordForm`.
- **Dependencies:** F-01.
