# F-03 — Accounts and Opening Balances (Sprint 1 contract)

> **Status:** contract for S1-11 (backend) and S1-14 (UI). Merged before any S1-11 code (S1-10).
> **Revision (S1-12, PR #24 review):** R4 now limits `openingDate` to 2000-01-01 … 2099-12-31, the same range as
> transaction dates, so a typo year cannot skew balances. AC-ACC-07 and T-ACC-API-07 updated to match.
> **Requirements:** FR-ACC-01, FR-ACC-02, FR-ACC-03, FR-ACC-04, FR-ACC-05 · BR-03, BR-04, BR-08, BR-12
> **Shared contracts used:** `docs/system-sds.md` §2 (roles), §3 (data model), §4 (balance rules), §5 (API)

## 1. Behaviour

In Sprint 1 users do not create accounts: every USER gets a fixed set of **seeded accounts**. A user can list
their accounts with current balances and set the **opening balance** (amount and date) of a Cash or Loan
account. Account management (create, rename, archive) is a Sprint 2 feature.

### 1.1 Seeded accounts

`server/prisma/seedData.ts` gives every user with role USER these accounts. ADMIN users get none.

| Name | `type` | `subtype` |
|---|---|---|
| Bank | CASH | BANK |
| Credit Card | LOAN_TAKEN | CREDIT_CARD |
| Salary | INCOME | — |
| Interest | INCOME | — |
| Dining | EXPENSE | — |
| Groceries | EXPENSE | — |
| Electricity | EXPENSE | — |
| Telecom | EXPENSE | — |

Seeded accounts start with `openingBalance = 0` and `openingDate = null`. Seeding is idempotent (re-running the
seed does not duplicate accounts or reset opening balances).

### 1.2 Workflow — set an opening balance

1. User opens the dashboard and chooses **Set opening balance** on a Cash or Credit Card account.
2. User enters an amount in baht and a date, then saves.
3. Server validates, saves `openingBalance` and `openingDate`, and returns the account with its new balance.
4. Dashboard shows the new balance. Income and expense totals do not change (BR-08).

Setting it again replaces the previous values; the opening balance is not cumulative.

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | A user sees and changes only their own accounts | BR-04 | 404 `NOT_FOUND` |
| R2 | Only CASH, LOAN_TAKEN, LOAN_GIVEN accounts take an opening balance | BR-12 | 400 `INVALID_ACCOUNT_TYPE` |
| R3 | `openingBalance` is an integer number of satang, 0 … 2,147,483,647 | BR-03 | 400 `VALIDATION_ERROR` |
| R4 | `openingDate` is a real calendar date `YYYY-MM-DD` from 2000-01-01 to 2099-12-31 (same range as transaction dates, F-04 §8) | — | 400 `VALIDATION_ERROR` |
| R5 | An opening balance is never income or expense | BR-08 | (computed; see F-05) |
| R6 | Balance = opening balance + transaction effects (`system-sds.md` §4.1) | FR-ACC-01 | (computed) |

Validation order for `PUT /api/accounts/:id/opening-balance`: body shape (R3, R4) → ownership (R1) → type (R2).
A non-numeric `:id` is treated as not found (404).

## 3. API

Both routes use `requireUser, requireRole("USER")`. Anonymous → 401 `UNAUTHENTICATED`; ADMIN → 403 `FORBIDDEN`.

### `GET /api/accounts`

```
200 { "accounts": Account[] }

Account = {
  "id": 1, "name": "Bank", "type": "CASH", "subtype": "BANK",
  "openingBalance": 1000000,          // satang
  "openingDate": "2026-11-01" | null,
  "balance": 3850000                   // satang, computed per system-sds.md §4
}
```

Order: by `type` in the order CASH, LOAN_TAKEN, LOAN_GIVEN, INCOME, EXPENSE, then by `name` A→Z.
For INCOME / EXPENSE accounts `balance` is the category's running total.

### `PUT /api/accounts/:id/opening-balance`

```
Request  { "openingBalance": 1000000, "openingDate": "2026-11-01" }
200      { "account": Account }        // same shape as one list item, balance recomputed
400      VALIDATION_ERROR  (details = zod fieldErrors)
400      INVALID_ACCOUNT_TYPE  (details: { "type": "EXPENSE" })
401 · 403 · 404
```

## 4. Data

No schema change: uses `Account.openingBalance` and `Account.openingDate` from migration
`add_financial_tables`. The database CHECK constraints `Account_openingBalance_allowed_type` and
`Account_openingBalance_nonnegative` back up R2 and R3.

## 5. UI (built in S1-14)

- **Dashboard (`/dashboard`)** — each CASH and LOAN_TAKEN account row has a **Set opening balance** link.
  INCOME / EXPENSE rows have none.
- **Opening balance form (`/accounts/:id/opening-balance`)** — heading shows the account name; fields
  *Amount (THB)* and *Date*; current values pre-filled. Save → back to `/dashboard`. Cancel → back without saving.
  Server errors appear in an alert above the form. Amount accepts `1500`, `1,500` or `1500.50`; more than two
  decimals or a negative number is rejected before sending.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-ACC-01 | Given seeded user alice, when she requests `GET /api/accounts`, then she gets exactly her 8 seeded accounts in the documented order, each with `balance` 0. |
| AC-ACC-02 | Given alice and bob both exist, when alice lists accounts, then none of bob's accounts appear. |
| AC-ACC-03 | When alice sets Bank's opening balance to 1,000,000 satang dated 2026-11-01, then the response and the next `GET /api/accounts` show Bank with `openingBalance` 1000000, `openingDate` "2026-11-01", `balance` 1000000. |
| AC-ACC-04 | Given Bank has an opening balance, when alice sets it again to 500,000, then the opening balance is 500,000 (replaced, not added). |
| AC-ACC-05 | When alice sets an opening balance on Credit Card (LOAN_TAKEN), it is accepted and Credit Card's `balance` (debt) equals it. |
| AC-ACC-06 | When alice sets an opening balance on Dining (EXPENSE) or Salary (INCOME), then 400 `INVALID_ACCOUNT_TYPE` and nothing changes. |
| AC-ACC-07 | When the amount is negative, a decimal, a string, above 2,147,483,647, or missing, or the date is missing / not a real date / outside 2000–2099, then 400 `VALIDATION_ERROR` and nothing changes. |
| AC-ACC-08 | When alice sets an opening balance on bob's account or a non-existent id, then 404 `NOT_FOUND` and bob's account is unchanged. |
| AC-ACC-09 | Anonymous → 401 and ADMIN → 403 on both routes. |
| AC-ACC-10 | After setting Bank's opening balance, summary income and expense totals are still 0 (BR-08). |
| AC-ACC-11 | Through the UI, alice sets Bank's opening balance to 10,000.00 THB and the dashboard then shows Bank 10,000.00. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-ACC-API-01 | API | `resetDb()`; `agentAs("alice")`; `GET /api/accounts` | 200; 8 accounts; names/types/order as §1.1 and §3; all `balance` 0 | AC-ACC-01 |
| T-ACC-API-02 | API | alice and bob; alice `GET /api/accounts` | no account has bob's `userId` (compare ids with bob's list) | AC-ACC-02 |
| T-ACC-API-03 | API | alice `PUT` Bank `{1000000, "2026-11-01"}`, then `GET` | 200; values as AC-ACC-03 in both responses | AC-ACC-03 |
| T-ACC-API-04 | API | Bank set to 1000000, then 500000 | `openingBalance` 500000 | AC-ACC-04 |
| T-ACC-API-05 | API | `PUT` Credit Card `{250000, …}` | 200; Credit Card `balance` 250000 | AC-ACC-05 |
| T-ACC-API-06 | API | `PUT` Dining and Salary `{100, …}` | 400 `INVALID_ACCOUNT_TYPE`; DB unchanged | AC-ACC-06 |
| T-ACC-API-07 | API (table) | amounts `-1`, `1.5`, `"100"`, `2147483648`, missing; dates `"2026-02-30"`, `"03/11/2026"`, missing, `"1999-12-31"`, `"2100-01-01"`, `"0026-11-01"` | each 400 `VALIDATION_ERROR`; DB unchanged | AC-ACC-07 |
| T-ACC-API-08 | API | alice `PUT` bob's Bank; `PUT /api/accounts/999999/…`; `PUT /api/accounts/abc/…` | 404 each; bob's Bank unchanged | AC-ACC-08 |
| T-ACC-API-09 | API | no session; `agentAs("admin")`; both routes | 401; 403 | AC-ACC-09 |
| T-ACC-API-10 | API | set Bank opening balance; `GET /api/summary` | `totals.income` 0, `totals.expense` 0 | AC-ACC-10 |
| T-ACC-SEED-01 | API/DB | run `seed()` twice | still 8 accounts per USER, 0 for admin; existing opening balance kept | §1.1 |
| T-ACC-UI-01 | Component | opening balance form, user types `1,500.50` | sends `openingBalance: 150050` | AC-ACC-11 |
| T-ACC-UI-02 | Component | user types `-5` or `1.234` | inline error; no request sent | AC-ACC-07 |
| T-ACC-E2E-01 | E2E | login alice; set Bank 10,000.00 | dashboard shows Bank 10,000.00 | AC-ACC-11 |

T-ACC-API-10 depends on `GET /api/summary` (S1-13). Until then it is written and expected to fail (TDD).

## 8. Definition of Done

- [ ] All T-ACC-API / T-ACC-SEED tests pass (`npm --prefix server test`); T-ACC-UI tests pass (`npm --prefix client test`); T-ACC-E2E-01 passes in S1-15
- [ ] Each rule test was seen failing before the implementation (noted in the PR)
- [ ] Lint, format and type check pass
- [ ] `docs/traceability.md` rows for FR-ACC-01…05 list these AC and test IDs
- [ ] PR into `Sprint-1/staging` reviewed and approved by the teammate

## 9. Version history

Times are Asia/Bangkok (UTC+7). Commit IDs are on `Sprint-1/staging`; PR links are in the repository.

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 1.0 | 2026-11-04 21:11 | `989daea` | #21 / S1-10 | First contract, before any S1-11 code (S1-11 first commit `69eaa22`, 22:09) |
| 1.1 | 2026-11-04 23:19 | `ebd8077` | #24 / S1-12 | Review fix: R4 limits `openingDate` to 2000-01-01 … 2099-12-31; AC-ACC-07 and T-ACC-API-07 updated |
