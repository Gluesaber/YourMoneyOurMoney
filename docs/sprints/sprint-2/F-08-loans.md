# F-08 — Debt & Receivable Lifecycle: Lending and Borrowing (Sprint 2 contract)

> **Status:** v0.1 draft for review. Merged before any F-08 code.
> **Requirements:** FR-TX-09, FR-ACC-02, FR-TX-01, FR-TX-02, FR-SUM-01 · BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-12, BR-13, BR-14
> **Depends on:** F-04, F-05, F-06 (creating LOAN_GIVEN / personal LOAN_TAKEN accounts), L7-01 / BR-14.
> **IDs:** `AC-DEBT-01…`, `T-DEBT-API-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

A user tracks money lent to people (LOAN_GIVEN, a receivable) and money borrowed (LOAN_TAKEN that is not a
credit card, a debt), with four guided actions. Each is stored as an ordinary F-04 transaction, so the Sprint 1
balance rules (`system-sds.md` §4.1) already give the effects; none of them is income or expense (BR-08).

| Action | Stored as | Cash | Loan account |
|---|---|---|---|
| **Lend** to Ben | PAYMENT from Cash, line LOAN_GIVEN "Ben" | − | outstanding + |
| **Get repaid** by Ben | RECEIVE into Cash, line LOAN_GIVEN "Ben" | + | outstanding − |
| **Borrow** from Mom | RECEIVE into Cash, line LOAN_TAKEN "Mom" | + | outstanding + |
| **Repay** Mom | PAYMENT from Cash, line LOAN_TAKEN "Mom" | − | outstanding − |

A **Loans** page lists every loan account with its outstanding amount, and the account's history.
The server API is unchanged; this feature is UI, a small read endpoint filter (F-09 `accountId`), and tests.

### 1.1 Demo journey (after the Sprint 1 demo; Bank 38,500.00)

| # | Action | Amount | Bank after | Ben (given) | Mom (taken) | Income / expense |
|---|---|---|---|---|---|---|
| 1 | Lend Ben | 5,000.00 | 33,500.00 | 5,000.00 | — | unchanged |
| 2 | Ben repays part | 2,000.00 | 35,500.00 | 3,000.00 | — | unchanged |
| 3 | Borrow from Mom | 10,000.00 | 45,500.00 | 3,000.00 | 10,000.00 | unchanged |
| 4 | Repay Mom in full | 10,000.00 | 35,500.00 | 3,000.00 | 0.00 | unchanged |

## 2. Rules and validation

No new server rule. The existing F-04 steps apply:

| Rule | Source | Result when broken |
|---|---|---|
| Cash side is a CASH account of the user; loan side is LOAN_GIVEN / LOAN_TAKEN of the user | BR-04, BR-09, BR-10 | 404 / 400 `INVALID_ACCOUNT_TYPE` |
| Amount integer satang 1 … 2,147,483,647 | BR-02, BR-03 | 400 `VALIDATION_ERROR` |
| Lend / Repay must not overdraw the Cash account | BR-14 | 400 `INSUFFICIENT_FUNDS` |
| Archived accounts cannot be used | F-06 R7 | 400 `ACCOUNT_ARCHIVED` |
| Saved all-or-nothing; never income or expense | BR-13, BR-08 | — |

**Repaying more than is outstanding** is not blocked by the server (see §8): the UI shows a warning
"This is more than the 3,000.00 outstanding" and asks to confirm. The resulting negative outstanding is shown
as "owes you" / "you overpaid" on the Loans page.

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| Server | unchanged (`ledger.ts`, `transactions.routes.ts`, `GET /api/summary` loansGiven / loansTaken) |
| `loanActionToTransaction(action, form)` → F-04 body | `client/src/lib/loans.ts` (pure, unit-tested) |
| Loans page and action forms | `client/src/pages/LoansPage.tsx`, `client/src/pages/LoanActionPage.tsx` (route `/loans/:id/:action`) |

## 3. API

No change. Uses `GET /api/summary` (`loansGiven`, `loansTaken` outstanding amounts), `GET /api/accounts` (the
`subtype`, to label credit cards — the summary has no `subtype`), `POST /api/transactions`, and
`GET /api/transactions?accountId=` (F-09) for a loan's history. The Loans page joins summary and accounts by
`accountId`. Example (Lend):

```
POST /api/transactions
{ "kind": "PAYMENT", "sourceAccountId": <Bank>, "date": "2026-11-22", "totalAmount": 500000,
  "lines": [ { "accountId": <Ben>, "amount": 500000 } ] }
```

## 4. Data

No schema change. LOAN_GIVEN / LOAN_TAKEN accounts are created through F-06; their opening balance (F-03) can
record a loan that existed before the user started.

## 5. UI

- Dashboard gets a **Loans** link; the dashboard's existing "loans given" section stays.
- **Loans page (`/loans`)**: two tables, "Money you lent" (LOAN_GIVEN) and "Money you owe" (LOAN_TAKEN, credit
  cards included, labelled), each with outstanding amount and buttons **Lend more / Get repaid** or
  **Borrow more / Repay**. Empty state links to "Add a loan account" (F-06 form with type preselected).
- **Loan action form (`/loans/:id/lend|repaid|borrow|repay`)**: *Cash account* (active CASH, with balance),
  *Amount (THB)*, *Date*, optional *Note*. Heading states the effect, e.g. "Lend to Ben". Over-repayment warning
  as in §2. Server errors in the alert, values kept. Success → `/loans`.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-DEBT-01 | Lending 5,000.00 from Bank to Ben → 201; Bank −5,000.00, Ben outstanding 5,000.00; income and expense totals unchanged. |
| AC-DEBT-02 | Ben repaying 2,000.00 into Bank → Bank +2,000.00, Ben 3,000.00; borrowing 10,000.00 from Mom → Bank +10,000.00, Mom 10,000.00; repaying Mom 10,000.00 → Mom 0.00. Income/expense unchanged throughout. |
| AC-DEBT-03 | Lending or repaying more than the Cash balance → 400 `INSUFFICIENT_FUNDS`, nothing saved. |
| AC-DEBT-04 | Using bob's loan account or a non-loan line (e.g. Dining in "Get repaid") → 404 / 400 `INVALID_ACCOUNT_TYPE`; ADMIN 403; anonymous 401. |
| AC-DEBT-05 | The Loans page lists each loan account with the outstanding amounts from `GET /api/summary`, and labels credit cards using `subtype` from `GET /api/accounts`. |
| AC-DEBT-06 | Repaying more than outstanding shows a warning before sending; after confirming, the loan shows the overpaid amount. |
| AC-DEBT-07 | E2E: alice creates "Ben" (LOAN_GIVEN), lends 5,000.00, records 2,000.00 repaid; Loans page shows Ben 3,000.00 and dashboard Bank 35,500.00. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-DEBT-API-01 | API | demo journey; create Ben (LOAN_GIVEN); lend 500,000; Ben repays 200,000 | 201 ×2; accounts Bank 3,550,000, Ben 300,000; summary totals unchanged | AC-DEBT-01, 02 |
| T-DEBT-API-02 | API | create Mom (LOAN_TAKEN, no subtype); borrow 1,000,000; repay 1,000,000 | Bank +/−, Mom 1,000,000 then 0; `loansTaken` lists Mom; totals unchanged | AC-DEBT-02 |
| T-DEBT-API-03 | API | Bank 0; lend 1 | 400 `INSUFFICIENT_FUNDS`; counts unchanged | AC-DEBT-03 |
| T-DEBT-API-04 | API | bob's Ben as line; "Get repaid" with Dining line; admin; anonymous | 404; 400 `INVALID_ACCOUNT_TYPE`; 403; 401 | AC-DEBT-04 |
| T-DEBT-UNIT-01 | Unit (client) | `loanActionToTransaction` for each of the 4 actions | kind/source/line exactly as §1 table | AC-DEBT-01, 02 |
| T-DEBT-UI-01 | Component | Loans page with mocked `GET /api/summary` (Ben 300,000, Mom 0, Credit Card 150,000) and `GET /api/accounts` (Credit Card `subtype` CREDIT_CARD, Mom `subtype` null) | both tables, values, only Credit Card labelled as a card | AC-DEBT-05 |
| T-DEBT-UI-02 | Component | "Get repaid" form for Ben (`/loans/:id/repaid`), outstanding 300,000, amount 3,500.00 | warning shown; nothing sent until confirmed | AC-DEBT-06 |
| T-DEBT-E2E-01 | E2E | as AC-DEBT-07 | Ben 3,000.00, Bank 35,500.00 | AC-DEBT-07 |

Regression kept: T-TX-*, T-FUND-*, T-SUM-* (loans sections), access suite, demo-journey E2E.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Storage | Existing PAYMENT / RECEIVE with a loan line; no new kind | Balance rules already correct; F-12 edit/void covers loans for free |
| Over-repayment | Warned in UI, not blocked by the server | Blocking would also change the Sprint 1 credit-card repayment rule (a second change to Sprint 1 behaviour, outside the approved Lab 7 change) |
| Interest | Not modelled | Out of the Theme 7 scope; record interest as an Interest INCOME / an EXPENSE line |
| Credit cards on the Loans page | Shown, labelled | They are LOAN_TAKEN; one place for all debt |

## 9. Definition of Done

- [ ] T-DEBT-API-01…04 pass (`npm --prefix server test`); T-DEBT-UNIT-01, T-DEBT-UI-01/02 pass (`npm --prefix client test`); T-DEBT-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-TX-09, `features.md` F-08 status, `traceability.md` rows updated
- [ ] PR into `Sprint-2/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-21 | `b6e700a` | #66 / S2-01 (#65) | First draft for review |
| 0.2 | 2026-11-22 | — | #66 review (Jirawat) | Credit-card label uses `subtype` from `GET /api/accounts` (summary has none); AC-DEBT-05 and T-DEBT-UI-01 updated; T-DEBT-UI-02 uses the "Get repaid" action for Ben (LOAN_GIVEN) |
