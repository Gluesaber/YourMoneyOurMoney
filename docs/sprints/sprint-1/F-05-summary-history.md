# F-05 — Balances, Summary and Transaction History (Sprint 1 contract)

> **Status:** contract for S1-13 (backend) and S1-14 (UI). Merged before any S1-13 code (S1-10).
> **Requirements:** FR-SUM-01, FR-SUM-02, FR-SUM-03, FR-HST-01, FR-HST-02 · BR-03, BR-04, BR-05, BR-08
> **Shared contracts used:** `docs/system-sds.md` §4 (balance rules, worked example), §5.3 (summary and transaction shapes)

## 1. Behaviour

A user sees, for their own data only:
- the balance of each **Cash** account,
- the outstanding debt of each **Loan Taken** account (including the credit card) and the receivable of each **Loan Given** account,
- **total income**, **total expense**, and the total of each income and expense category,
- the **transaction history**, newest first, and the **detail** of one transaction with its lines.

Nothing is stored: every number is computed from opening balances and transactions with the rules in
`system-sds.md` §4.1, so the figures are always consistent with the history.

## 2. Rules

| # | Rule | Source |
|---|---|---|
| R1 | `balance(account) = openingBalance + Σ source effects + Σ line effects` (SDS §4.1) | FR-SUM-01 |
| R2 | Income = Σ RECEIVE lines on INCOME accounts; expense = Σ PAYMENT lines on EXPENSE accounts | FR-SUM-03, BR-08 |
| R3 | Opening balances, transfers, borrowing, lending and repayments never change income or expense | BR-08 |
| R4 | Only the user's own accounts and transactions are read; another user's transaction → 404 | BR-04 |
| R5 | ADMIN gets 403 on every route here | BR-05 |
| R6 | All amounts are integer satang | BR-03 |

### 2.1 Where the logic lives

`computeBalances(accounts, transactions)` in `server/src/services/ledger.ts` — a pure function that returns
`Map<accountId, balance>`. Both `GET /api/summary` and `GET /api/accounts` (F-03) use it, so the two can never
disagree. Sprint 1 computes in application code from the user's rows; a SQL aggregate can replace it later
without changing the API.

## 3. API

All routes: `requireUser, requireRole("USER")`. Anonymous → 401; ADMIN → 403.

### `GET /api/summary`

Shape as `system-sds.md` §5.3:

```
200 {
  "cash":       [ { "accountId", "name", "balance" } ],        // every CASH account
  "loansTaken": [ { "accountId", "name", "outstanding" } ],    // every LOAN_TAKEN account
  "loansGiven": [ { "accountId", "name", "outstanding" } ],    // every LOAN_GIVEN account
  "totals":     { "income", "expense" },
  "income":     [ { "accountId", "name", "total" } ],          // every INCOME account
  "expense":    [ { "accountId", "name", "total" } ]           // every EXPENSE account
}
```

Every account of each type is listed, including zero values; each list is ordered by `name` A→Z.

### `GET /api/transactions`

`200 { "transactions": Transaction[] }` — all of the user's transactions, newest `date` first, then highest `id`
first. No pagination or filters in Sprint 1 (filters arrive with search in Sprint 2).

### `GET /api/transactions/:id`

`200 { "transaction": Transaction }` · 404 if it does not exist, belongs to another user, or `:id` is not a
positive integer.

`Transaction` is the shape in `system-sds.md` §5.3, identical in the list, the detail and the
`POST /api/transactions` response (F-04).

## 4. Data

No schema change. Reads `Account`, `Transaction`, `TransactionLine` filtered by `userId`.

## 5. UI (built in S1-14)

- **Dashboard (`/dashboard`)**
  - *Accounts* — each Cash account with its balance; each Loan Taken account with its outstanding debt;
    Loan Given section shown only if the user has such accounts. Negative balances are shown in red with a minus sign.
  - *Income and expense* — total income, total expense, and a table of every category total.
  - Buttons: **Record payment**, **Record money received** (F-04), **Set opening balance** per eligible account (F-03),
    link **History**.
  - Empty state: a new user sees all accounts at 0.00 and a hint to set an opening balance.
- **History (`/transactions`)** — table: date, kind (Payment / Receive), source, a short summary of lines
  (e.g. "Dining, Groceries"), total. Each row links to the detail. Empty state: "No transactions yet".
- **Detail (`/transactions/:id`)** — kind, date, source, note, total, and every line with account and amount.
  A 404 shows "Transaction not found" with a link back to History.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-SUM-01 | Given a new seeded user, `GET /api/summary` lists every account with 0 and totals 0. |
| AC-SUM-02 | Given the demo journey (opening Bank 1,000,000; demo transactions #1–#3 in F-04), the summary shows Bank 3,850,000; Credit Card outstanding 0; income 3,000,000; expense 150,000; Salary 3,000,000; Dining 90,000; Groceries 60,000; every other category 0. |
| AC-SUM-03 | After demo #2 only (before repayment), Credit Card outstanding is 150,000. |
| AC-SUM-04 | Opening balances, the card repayment, a Bank→Wallet-style CASH transfer and a borrowing line never change `totals.income` or `totals.expense`. |
| AC-SUM-05 | `GET /api/accounts` balances equal the summary values for the same accounts. |
| AC-SUM-06 | alice's summary is unaffected by bob's transactions. |
| AC-HST-01 | `GET /api/transactions` returns only the user's transactions, newest date first and, on the same date, highest id first. |
| AC-HST-02 | `GET /api/transactions/:id` returns the transaction with source and all lines; another user's id, a missing id and a non-numeric id → 404. |
| AC-HST-03 | Anonymous → 401 and ADMIN → 403 on all three routes. |
| AC-SUM-07 | In the UI, after the demo journey the dashboard shows Bank 38,500.00, Credit Card 0.00, income 30,000.00, expense 1,500.00, and History lists the three transactions newest first. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-SUM-UNIT-01 | Unit | `computeBalances` with no transactions | each balance = its opening balance | AC-SUM-01 |
| T-SUM-UNIT-02 | Unit | demo journey rows | Bank 3850000, Credit Card 0, Salary 3000000, Dining 90000, Groceries 60000 | AC-SUM-02 |
| T-SUM-UNIT-03 | Unit (table) | one transaction per cell of SDS §4.1 (every source × line type) | each account moves by exactly the documented sign | AC-SUM-04 |
| T-SUM-UNIT-04 | Unit | opening balance + repayment + CASH→CASH transfer + borrowing | income and expense totals 0 | AC-SUM-04 |
| T-SUM-API-01 | API | `resetDb()`; alice; `GET /api/summary` | all lists present, all values 0 | AC-SUM-01 |
| T-SUM-API-02 | API | alice runs the demo journey through the API | values exactly as AC-SUM-02 | AC-SUM-02 |
| T-SUM-API-03 | API | opening + demo #1 + #2 only | Credit Card outstanding 150000 | AC-SUM-03 |
| T-SUM-API-04 | API | after T-SUM-API-02, `GET /api/accounts` | balances equal summary values | AC-SUM-05 |
| T-SUM-API-05 | API | bob records transactions; alice `GET /api/summary` | alice's values unchanged | AC-SUM-06 |
| T-HST-API-01 | API | alice: three transactions on two dates; bob: one | alice gets exactly her three in the documented order | AC-HST-01 |
| T-HST-API-02 | API | alice `GET` own id; bob's id; 999999; `abc` | 200 with lines; 404; 404; 404 | AC-HST-02 |
| T-HST-API-03 | API | no session; admin; all three routes | 401; 403 | AC-HST-03 |
| T-SUM-UI-01 | Component | dashboard with a fixed summary response | renders balances and totals with `formatBaht`; negative shown with minus | AC-SUM-07 |
| T-HST-UI-01 | Component | history with an empty list; with three items | empty-state text; three rows in given order | AC-HST-01 |
| T-SUM-E2E-01 | E2E (S1-15) | alice logs in and performs the whole demo journey through the UI | dashboard and history as AC-SUM-07 | AC-SUM-07 |

## 8. Definition of Done

- [ ] T-SUM-UNIT / T-SUM-API / T-HST-API tests pass (`npm --prefix server test`); T-SUM-UI / T-HST-UI pass (`npm --prefix client test`); T-SUM-E2E-01 passes in S1-15
- [ ] T-SUM-API-02 (the demo journey numbers) was seen failing before the implementation (noted in the PR)
- [ ] `GET /api/accounts` and `GET /api/summary` both use `computeBalances`
- [ ] Lint, format and type check pass
- [ ] `docs/traceability.md` rows for FR-SUM-01…03 and FR-HST-01…02 list these AC and test IDs
- [ ] PR into `Sprint-1/staging` reviewed and approved by the teammate

## 9. Version history

Times are Asia/Bangkok (UTC+7). Commit IDs are on `Sprint-1/staging`; PR links are in the repository.

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 1.0 | 2026-11-04 21:11 | `989daea` | #21 / S1-10 | First contract, before any S1-13 code (S1-13 commit `3a174ba`, 23:36) |
