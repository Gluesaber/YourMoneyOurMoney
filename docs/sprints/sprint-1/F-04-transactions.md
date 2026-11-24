# F-04 — Record a Transaction: Payment and Receive (Sprint 1 contract)

> **Status:** v1.1 — contract for S1-12 / S1-14 (v1.0, S1-10); revised by the Lab 7 change L7-01 (#64, approved by
> the TA 2026-11-24) before any L7-01 code: new BR-14 (§2 step 7, §6, §7, §8, §10). Impact: `docs/labs/lab07/change-impact.md`.
> **Requirements:** FR-TX-01, FR-TX-02, FR-TX-04, FR-TX-05, FR-TX-06 · BR-01, BR-02, BR-03, BR-04, BR-09, BR-10, BR-11, BR-13, BR-14 (v1.1)
> **Shared contracts used:** `docs/system-sds.md` §3.3 (where rules are enforced), §4.1 (balance effects), §5.3 (API shapes)

## 1. Behaviour

A user records money movements with two forms, each with **one or more allocation lines**:

- **Payment** — money leaves a Cash account, or is charged to a Loan Taken account (e.g. a credit card).
  Lines say where it went: expenses, repaying a loan taken, lending (loan given), or a transfer to another Cash account.
- **Receive** — money arrives in a Cash account. Lines say where it came from: income, repayment of a loan given,
  new borrowing (loan taken), or a transfer from another Cash account.

The lines must add up exactly to the total. The transaction is saved all at once or not at all.

### 1.1 Sprint 1 demo transactions

| # | Form | Source | Lines | Total |
|---|---|---|---|---|
| 1 | RECEIVE | Bank | Salary 3,000,000 | 3,000,000 |
| 2 | PAYMENT | Credit Card | Dining 90,000 + Groceries 60,000 | 150,000 |
| 3 | PAYMENT | Bank | Credit Card 150,000 (repayment) | 150,000 |

(amounts in satang; balance results are in F-05.)

All other line types in BR-10 (lend, borrow, transfers) are accepted by the API from Sprint 1, because the
balance rules already cover them; the dedicated UI for them comes in Sprint 2.

## 2. Rules and validation

Checks run in this order; the **first** failure is returned, and nothing is saved.

| Step | Check | Source | Error |
|---|---|---|---|
| 1 | Body shape: `kind` is PAYMENT or RECEIVE; `sourceAccountId` positive integer; `date` real `YYYY-MM-DD` between 2000-01-01 and 2099-12-31; `totalAmount` integer 1 … 2,147,483,647; `note` optional string ≤ 200 chars; `lines` 1 … 20 items, each `{ accountId: positive integer, amount: integer 1 … 2,147,483,647 }` | BR-02, BR-03 | 400 `VALIDATION_ERROR` (details = zod fieldErrors) |
| 2 | Source account and every line account exist **and belong to the user** | BR-04 | 404 `NOT_FOUND` |
| 3 | Source type: PAYMENT → CASH or LOAN_TAKEN; RECEIVE → CASH | BR-09 | 400 `INVALID_ACCOUNT_TYPE`, details `{ "field": "sourceAccountId", "type": … }` |
| 4 | The source account is not one of the lines | BR-11 | 400 `VALIDATION_ERROR`, details `{ "field": "lines", "lineIndex": n }` |
| 5 | Line types: PAYMENT → EXPENSE, LOAN_TAKEN, LOAN_GIVEN, CASH; RECEIVE → INCOME, LOAN_GIVEN, LOAN_TAKEN, CASH | BR-10 | 400 `INVALID_ACCOUNT_TYPE`, details `{ "field": "lines", "lineIndex": n, "type": … }` |
| 6 | Sum of line amounts equals `totalAmount` | BR-01 | 400 `ALLOCATION_MISMATCH`, details `{ "totalAmount", "linesTotal", "difference" }` |
| 7 | *(v1.1, BR-14)* No CASH account the transaction decreases ends below 0. Decrease = `totalAmount` when a CASH account is the PAYMENT source, plus every RECEIVE line on a CASH account (summed per account). Balance = opening balance + every recorded transaction of the user, whatever its date (`system-sds.md` §4.1), read inside the save transaction after locking the decreased CASH rows **in ascending `id` order** (`SELECT "id" FROM "Account" WHERE "id" IN (…) ORDER BY "id" FOR UPDATE`, before the balances are loaded) so two requests can never lock the same accounts in opposite order | BR-14 | 400 `INSUFFICIENT_FUNDS`, message "This would overdraw <name>.", details `{ "accountId", "balance", "required", "shortfall" }` where `balance` = the account's current balance, `required` = this transaction's decrease of it, `shortfall` = `required − balance` (e.g. balance −10,000, PAYMENT 5,000 → shortfall 15,000) |
| 8 | Save transaction and lines in one `prisma.$transaction` (`TransactionLine.userId` = the user) | BR-13, BR-04 | any failure → nothing saved |

Other decisions (see §8):
- Two lines may use the same account (e.g. two Dining lines); they are simply summed.
- *(v1.1)* A Cash balance may no longer go negative through a new transaction (step 7). Balances that were already
  negative are kept; such an account still accepts RECEIVEs. LOAN_TAKEN sources have no limit.
- `note` is trimmed; an empty note is stored as `null`.

### 2.1 Where the logic lives

| Piece | Location | Notes |
|---|---|---|
| zod schema (step 1) | `server/src/routes/transactions.routes.ts` | |
| `validateTransaction(input, accountsById)` (steps 3–6) | `server/src/services/ledger.ts` | Pure function, no database; throws `AppError`. Unit-tested on its own. |
| Ownership lookup (step 2) and save (step 8) | route + `prisma.$transaction` | One query for all involved accounts filtered by `userId`; the F-06 archived check follows step 2 |
| `checkCashFunds(input, accountsById, balances)` (step 7, v1.1) | `server/src/services/ledger.ts` | Pure; called inside the save transaction after locking the decreased CASH rows in ascending `id` order (`… ORDER BY "id" FOR UPDATE`) and then loading balances with the transaction client |

## 3. API

`POST /api/transactions` — `requireUser, requireRole("USER")`. Anonymous → 401; ADMIN → 403.

```
Request
{
  "kind": "PAYMENT",
  "sourceAccountId": 2,
  "date": "2026-11-03",
  "totalAmount": 150000,
  "note": "Dinner and groceries",
  "lines": [ { "accountId": 5, "amount": 90000 }, { "accountId": 6, "amount": 60000 } ]
}

201 { "transaction": Transaction }      // shape: system-sds.md §5.3, lines in request order
400 VALIDATION_ERROR | INVALID_ACCOUNT_TYPE | ALLOCATION_MISMATCH | ACCOUNT_ARCHIVED (F-06) | INSUFFICIENT_FUNDS (v1.1)
401 · 403 · 404
```

## 4. Data

No schema change. Writes one `Transaction` and its `TransactionLine` rows. The database backs up step 1
(`*_positive` checks) and step 2 (composite foreign keys on `(id, userId)`).

## 5. UI (built in S1-14)

**Form (`/transactions/new?kind=PAYMENT` or `?kind=RECEIVE`)**, reached from the **Record payment** /
**Record money received** buttons on the dashboard.

- **Source** select: only accounts allowed by step 3 for the chosen form.
- **Date**: defaults to today (browser's local date).
- **Total (THB)** and optional **Note**.
- **Allocation lines**: each line has an account select (types allowed by step 5, source excluded) and an
  amount. **Add line** / **Remove** (at least one line always stays).
- **Remaining to allocate** = total − sum of lines, updated as the user types; shown in red when not 0.
- **Save** is disabled until the remaining amount is exactly 0 and every field is filled; it is disabled while
  the request is in flight.
- On success → `/transactions/:id`. On a server error → its `message` in an alert above the form; the form keeps
  its values.

**Money conversion (`client/src/lib/money.ts`, integration point 9):**
- `toSatang(text)`: accepts digits with optional thousands commas and up to 2 decimals (`"1500"`, `"1,500"`,
  `"1500.5"`, `"1,500.50"`); returns satang (`150000`, `150050`). Returns `null` for empty, negative,
  more than 2 decimals, or non-numeric input. Uses string arithmetic, never `parseFloat(x) * 100`.
- `formatBaht(satang)`: `150050` → `"1,500.50"`; `0` → `"0.00"`; negatives keep the sign (`"-1,500.00"`).

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-TX-01 | When alice records RECEIVE into Bank with one Salary line 3,000,000 = total, then 201 and the response matches the stored transaction. |
| AC-TX-02 | When alice records PAYMENT from Credit Card split Dining 90,000 + Groceries 60,000 (total 150,000), then 201 with both lines in order. |
| AC-TX-03 | When alice's Bank holds at least 1,500.00 and she records PAYMENT from Bank with one Credit Card line 150,000, then 201 (a repayment). *(v1.1: funding precondition added for BR-14; v1.0 had none.)* |
| AC-TX-04 | When lines sum to more or less than the total, then 400 `ALLOCATION_MISMATCH` with the difference, and no transaction or line is stored. |
| AC-TX-05 | When the total or any line is 0 or negative, a decimal, or there are no lines, then 400 `VALIDATION_ERROR` and nothing is stored. |
| AC-TX-06 | When the source type is wrong for the form (RECEIVE into Credit Card; PAYMENT from Dining), then 400 `INVALID_ACCOUNT_TYPE`. |
| AC-TX-07 | When a line type is wrong for the form (PAYMENT → Salary; RECEIVE → Dining), then 400 `INVALID_ACCOUNT_TYPE` naming the line. |
| AC-TX-08 | When the source account also appears as a line, then 400 `VALIDATION_ERROR`. |
| AC-TX-09 | When the source or any line account belongs to bob or does not exist, then 404 `NOT_FOUND` and nothing is stored. |
| AC-TX-10 | Anonymous → 401; ADMIN → 403. |
| AC-TX-11 | When a request fails at step 6, the database has the same number of transactions and lines as before (all-or-nothing). |
| AC-TX-12 | In the UI, Save stays disabled until remaining-to-allocate is 0, and the split card purchase can be recorded end to end. |
| AC-FUND-01 | *(v1.1)* Given Bank = 1,500.00, PAYMENT from Bank of exactly 1,500.00 → 201 and Bank = 0.00. |
| AC-FUND-02 | *(v1.1)* Given Bank = 1,500.00, PAYMENT from Bank of 1,500.01 → 400 `INSUFFICIENT_FUNDS`, `shortfall` 1; transaction / line counts and every balance unchanged. |
| AC-FUND-03 | *(v1.1)* A RECEIVE whose CASH line(s) would take that account below 0 (lines on one account summed) → 400 `INSUFFICIENT_FUNDS` naming that account. |
| AC-FUND-04 | *(v1.1)* PAYMENT from Credit Card (LOAN_TAKEN) of any valid amount → 201; RECEIVE into a CASH account → 201 even if that account is negative. |
| AC-FUND-05 | *(v1.1)* Steps 1–6 and the F-06 archived check take priority over `INSUFFICIENT_FUNDS`; another user's account → 404; ADMIN → 403; anonymous → 401. |
| AC-FUND-06 | *(v1.1)* In the form, an overdrawing payment shows the server's message and keeps the entered values. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-TX-UNIT-01 | Unit | `validateTransaction` with valid PAYMENT and RECEIVE inputs (demo #1–#3) | no error | AC-TX-01…03 |
| T-TX-UNIT-02 | Unit | lines sum 149,999 and 150,001 vs total 150,000 | `ALLOCATION_MISMATCH`, `difference` −1 / +1 | AC-TX-04 |
| T-TX-UNIT-03 | Unit (table) | each disallowed source type per form | `INVALID_ACCOUNT_TYPE` | AC-TX-06 |
| T-TX-UNIT-04 | Unit (table) | each disallowed line type per form | `INVALID_ACCOUNT_TYPE` with `lineIndex` | AC-TX-07 |
| T-TX-UNIT-05 | Unit | source id repeated as a line | `VALIDATION_ERROR` with `lineIndex` | AC-TX-08 |
| T-TX-UNIT-06 | Unit | wrong source type **and** wrong sum | the step-3 error (order is fixed) | §2 |
| T-TX-API-01 | API | `resetDb()`; alice; demo #1 | 201; body = §5.3 shape; one row in DB | AC-TX-01 |
| T-TX-API-02 | API | demo #2 | 201; lines Dining 90000, Groceries 60000 in order | AC-TX-02 |
| T-TX-API-03 | API | demo #1 (salary into Bank), then demo #3 *(v1.1: Bank funded first)* | 201 | AC-TX-03 |
| T-TX-API-04 | API | lines ≠ total | 400 `ALLOCATION_MISMATCH`; transaction and line counts unchanged | AC-TX-04, AC-TX-11 |
| T-TX-API-05 | API (table) | total 0, −1, 1.5; line 0; `lines: []`; 21 lines; bad date `2026-02-30`; date `1999-12-31`; note of 201 chars; unknown `kind` | each 400 `VALIDATION_ERROR`; counts unchanged | AC-TX-05 |
| T-TX-API-06 | API | RECEIVE into Credit Card; PAYMENT from Dining | 400 `INVALID_ACCOUNT_TYPE` | AC-TX-06 |
| T-TX-API-07 | API | PAYMENT with a Salary line; RECEIVE with a Dining line | 400 `INVALID_ACCOUNT_TYPE` | AC-TX-07 |
| T-TX-API-08 | API | Bank as source and line | 400 `VALIDATION_ERROR` | AC-TX-08 |
| T-TX-API-09 | API | source = bob's Bank; line = bob's Dining; source id 999999 | 404 each; counts unchanged | AC-TX-09 |
| T-TX-API-10 | API | no session; admin | 401; 403 | AC-TX-10 |
| T-MONEY-UNIT-01 | Unit (client) | `toSatang` on `"1500"`, `"1,500"`, `"1500.5"`, `"1,500.50"`, `"0.01"`, `""`, `"-1"`, `"1.234"`, `"abc"` | `150000`, `150000`, `150050`, `150050`, `1`, `null`, `null`, `null`, `null` | AC-TX-12 |
| T-MONEY-UNIT-02 | Unit (client) | `formatBaht(150050)`, `(0)`, `(-150000)`, `(2147483647)` | `"1,500.50"`, `"0.00"`, `"-1,500.00"`, `"21,474,836.47"` | AC-TX-12 |
| T-TX-UI-01 | Component | form with total 1,500.00 and one line 900.00 | remaining shows 600.00; Save disabled; add line 600.00 → Save enabled | AC-TX-12 |
| T-TX-UI-02 | Component | server replies `ALLOCATION_MISMATCH` | alert shows its message; inputs keep their values | AC-TX-04 |
| T-FUND-UNIT-01 | Unit | `checkCashFunds`: Bank balance 150,000; PAYMENT 150,000 / 150,001; Bank already at −10,000, PAYMENT 5,000 | no error / `INSUFFICIENT_FUNDS` `{ balance 150000, required 150001, shortfall 1 }` / `{ balance -10000, required 5000, shortfall 15000 }` | AC-FUND-01, 02 |
| T-FUND-UNIT-02 | Unit | RECEIVE into Bank, lines Wallet 30,000 + Wallet 30,000, Wallet balance 50,000 | `INSUFFICIENT_FUNDS` for Wallet, required 60,000 | AC-FUND-03 |
| T-FUND-UNIT-03 | Unit | Card source of any amount; RECEIVE into Bank at −10,000; PAYMENT from Card with a CASH line (money into Wallet) | no error | AC-FUND-04 |
| T-FUND-API-01 | API | `resetDb()`; Bank opening 150,000; PAYMENT Bank → Dining 150,000 | 201; `GET /api/accounts` Bank 0 | AC-FUND-01 |
| T-FUND-API-02 | API | Bank opening 150,000; PAYMENT Bank → Dining 150,001 | 400 `INSUFFICIENT_FUNDS`, details as above; counts and every balance unchanged | AC-FUND-02 |
| T-FUND-API-03 | API | Bank 0 (no opening balance); PAYMENT Bank → Dining 1 | 400 `INSUFFICIENT_FUNDS`, shortfall 1 | AC-FUND-02 |
| T-FUND-API-04 | API | PAYMENT Card → Dining 2,147,483,647 → 201; a Bank already at −10,000 (fixture row written with Prisma, as data from before L7-01) receives Salary 1 | 201; 201 | AC-FUND-04 |
| T-FUND-API-05 | API | Bank 0; PAYMENT Bank with lines ≠ total; PAYMENT Bank with a Salary line; PAYMENT to an archived Telecom | `ALLOCATION_MISMATCH`; `INVALID_ACCOUNT_TYPE`; `ACCOUNT_ARCHIVED` (never `INSUFFICIENT_FUNDS`) | AC-FUND-05 |
| T-FUND-API-06 | API | bob's Bank opening 1,000,000; alice sends PAYMENT from bob's Bank 1; admin and anonymous send a valid PAYMENT | 404 `NOT_FOUND` (no balance in the body); 403; 401 | AC-FUND-05 |
| T-FUND-API-07 | API | *(from F-07 v0.3, was T-TX-API-13)* Wallet (created through F-06) holds 200,000; transfer Wallet → Bank 200,001, then 200,000 | 400 `INSUFFICIENT_FUNDS`, counts unchanged; 201, Wallet 0 | AC-FUND-01, 02 (F-07 AC-TX-15) |
| T-FUND-API-08 | API | *(from F-08 v0.3, was T-DEBT-API-03)* Bank 0; create Ben (LOAN_GIVEN); lend Ben 1 | 400 `INSUFFICIENT_FUNDS`, counts unchanged | AC-FUND-02 (F-08 AC-DEBT-03) |
| T-FUND-API-09 | API | Wallet holds 50,000; RECEIVE into Bank with lines Wallet 30,000 + Wallet 30,000 | 400 `INSUFFICIENT_FUNDS` naming Wallet, `required` 60,000, `shortfall` 10,000; counts unchanged | AC-FUND-03 |
| T-FUND-UI-01 | Component | payment form; server replies 400 `INSUFFICIENT_FUNDS` "This would overdraw Bank." | alert shows the message; inputs keep their values | AC-FUND-06 |
| T-TX-E2E-01 | E2E | alice records demo #2 through the form | lands on the transaction page showing both lines | AC-TX-12 |

## 8. Decisions made in this contract

| Decision | Choice | Why |
|---|---|---|
| Overdraft (open question in SDS §4.4) | ~~Allowed — no negative-balance check~~ (v1.0). **v1.1: not allowed for CASH accounts (BR-14, L7-01 #64, approved by the TA 2026-11-24).** LOAN_TAKEN unchanged; existing negative balances kept and still shown in red | v1.0 reason: refusing cannot undo a real payment. v1.1 reason (changed requirement): Cash accounts are money the user holds and the product has no overdraft facility; refusing at save time, with the shortfall, catches a wrong source account or a payment entered before its income |
| Future dates (SDS §4.4) | Allowed within 2000-01-01 … 2099-12-31 | No "today" or time-zone logic on the server; the range still catches typo years |
| Same account on two lines | Allowed | Summing them is correct; rejecting adds a rule without a requirement |
| Max lines | 20 | Keeps requests bounded; far above any receipt split |
| Note length | ≤ 200 characters | Bounded input |

## 9. Definition of Done

- [ ] T-TX-UNIT and T-TX-API tests pass (`npm --prefix server test`); T-MONEY-UNIT and T-TX-UI pass (`npm --prefix client test`); T-TX-E2E-01 passes in S1-15
- [ ] Each rule test was seen failing before the implementation (noted in the PR)
- [ ] *(v1.1)* T-FUND-UNIT / T-FUND-API / T-FUND-UI pass; RED on the pre-change code `943b463` recorded in the L7-01 PR
- [ ] `validateTransaction` and `checkCashFunds` have no database or Express dependency
- [ ] Lint, format and type check pass
- [ ] `docs/traceability.md` rows for FR-TX-01, 02, 04, 05, 06 list these AC and test IDs
- [ ] PR into `Sprint-1/staging` reviewed and approved by the teammate

## 10. Version history

Times are Asia/Bangkok (UTC+7). Commit IDs are on `Sprint-1/staging`; PR links are in the repository.

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 1.0 | 2026-11-04 21:11 | `989daea` | #21 / S1-10 | First contract, before any S1-12 code (S1-12 first commit `30befe0`, 22:45) |
| 1.1 | 2026-11-24 | — | L7-01 (#64), before code | BR-14 (no Cash overdraft): §2 step 7 (save becomes step 8), §2.1, §3 error, §6 AC-TX-03 precondition + AC-FUND-01…06, §7 T-TX-API-03 revised + T-FUND-UNIT-01…03, T-FUND-API-01…09, T-FUND-UI-01, §8 overdraft decision reversed. Approved change request #64 (TA, 2026-11-24) |
