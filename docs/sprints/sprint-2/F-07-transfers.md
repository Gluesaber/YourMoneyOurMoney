# F-07 — Internal Account Transfers (Sprint 2 contract)

> **Status:** v0.1 draft for review. Merged before any F-07 code.
> **Requirements:** FR-TX-03, FR-SUM-03 · BR-01, BR-02, BR-03, BR-04, BR-08, BR-09, BR-10, BR-11, BR-13, BR-14
> **Depends on:** F-04 (transaction save path), F-05 (balances/summary), F-06 (creating a second CASH account),
> L7-01 / BR-14 (no Cash overdraft — merged first).
> **IDs:** uses the `AC-TX-13…` / `T-TX-API-11…` range already reserved for F-07 in `docs/traceability.md`.

## 1. Behaviour

A user moves money between two of their own Cash accounts (e.g. Bank → Wallet) with a dedicated **Transfer**
form. A transfer is stored as an ordinary transaction — **PAYMENT from the "from" account with one CASH line to
the "to" account** — so the Sprint 1 balance rules (`system-sds.md` §4.1) already give the right effects:
"from" decreases, "to" increases, and income/expense totals do not change (BR-08).

The API is unchanged: `POST /api/transactions` already accepts CASH lines (F-04 §1). The RECEIVE-with-CASH-line
form stays valid through the API but the UI always records transfers as PAYMENT, so every transfer looks the
same in history.

### 1.1 Demo transfer

| # | From | To | Amount | Bank after | Wallet after | Income / expense |
|---|---|---|---|---|---|---|
| 1 | Bank (38,500.00 after the Sprint 1 demo) | Wallet (new, 0.00) | 2,000.00 | 36,500.00 | 2,000.00 | unchanged 30,000.00 / 1,500.00 |

## 2. Rules and validation

All checks are the existing F-04 steps; F-07 adds no new server rule.

| Rule | Source | Result when broken |
|---|---|---|
| "From" is a CASH account of the user | BR-04, BR-09 | 404 / 400 `INVALID_ACCOUNT_TYPE` |
| "To" is a CASH account of the user | BR-04, BR-10 | 404 / (UI only offers CASH) |
| From ≠ to | BR-11 | 400 `VALIDATION_ERROR` |
| Amount integer satang 1 … 2,147,483,647; one line equal to the total | BR-01, BR-02, BR-03 | 400 `VALIDATION_ERROR` / `ALLOCATION_MISMATCH` |
| "From" balance after transfer ≥ 0 | BR-14 | 400 `INSUFFICIENT_FUNDS` |
| Archived account cannot be used | F-06 R7 | 400 `ACCOUNT_ARCHIVED` |
| Never income or expense | BR-08 | (computed; summary unchanged) |
| Saved all-or-nothing | BR-13 | nothing saved on any error |

**Transfer, as displayed** (client-side, no stored flag): a transaction whose source is CASH and whose every
line is a CASH account. The arrow follows the money: PAYMENT shows "Transfer: <source> → <line>"; RECEIVE (a
transfer recorded through the API into the source) shows "Transfer: <line> → <source>". Example: RECEIVE into Bank
with a Wallet line is "Transfer: Wallet → Bank".

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| Server rules | unchanged: `validateTransaction`, `checkCashFunds` (`ledger.ts`), `transactions.routes.ts` |
| `isTransfer(transaction, accountsById)`, `transferLabel(transaction, accountsById)` | `client/src/lib/transactions.ts` (pure, unit-tested) |
| Transfer form | `client/src/pages/TransferFormPage.tsx` (new), route `/transfers/new` |

## 3. API

No change. The form sends:

```
POST /api/transactions
{ "kind": "PAYMENT", "sourceAccountId": <from>, "date": "2026-11-22", "totalAmount": 200000,
  "note": "ATM", "lines": [ { "accountId": <to>, "amount": 200000 } ] }
→ 201 { transaction } · 400 VALIDATION_ERROR | ALLOCATION_MISMATCH | INVALID_ACCOUNT_TYPE | INSUFFICIENT_FUNDS
  | ACCOUNT_ARCHIVED · 401 · 403 · 404
```

## 4. Data

No schema change.

## 5. UI

- Dashboard gets a **Transfer** button next to Record payment / Record money received; shown only when the user
  has at least two active CASH accounts (otherwise a hint "Add a second cash account to transfer").
- **Transfer form (`/transfers/new`)**: *From* (active CASH accounts, with current balance), *To* (active CASH
  accounts except From), *Amount (THB)*, *Date* (default today), optional *Note*. Save disabled until From, To,
  a valid amount and a date are set and From ≠ To. Server errors appear in the alert above the form, values kept.
  On success → `/transactions/:id`.
- History list and detail page label transfers "Transfer: <from> → <to>" in the direction the money moved (§2).

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-TX-13 | Given alice has Bank 38,500.00 and Wallet 0.00, when she transfers 2,000.00 Bank → Wallet, then 201, Bank 36,500.00, Wallet 2,000.00. |
| AC-TX-14 | After any transfer, summary income and expense totals and every category total are unchanged (BR-08). |
| AC-TX-15 | Transferring more than the From balance → 400 `INSUFFICIENT_FUNDS`, nothing saved; exactly the balance → 201 and From = 0.00. |
| AC-TX-16 | From = To → 400 `VALIDATION_ERROR`; To = bob's Wallet → 404 and nothing saved; ADMIN → 403; anonymous → 401. |
| AC-TX-17 | History and detail show the transfer as "Transfer: Bank → Wallet"; a RECEIVE into Bank with a Wallet line shows "Transfer: Wallet → Bank"; a normal payment is not labelled a transfer. |
| AC-TX-18 | In the UI the Transfer form offers only active CASH accounts, excludes From from To, and keeps Save disabled until the form is complete. |
| AC-TX-19 | E2E: alice creates Wallet (F-06), transfers 2,000.00 from Bank and the dashboard shows both new balances. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-TX-API-11 | API | demo journey; create Wallet (CASH/WALLET); transfer 200,000 Bank → Wallet | 201; `GET /api/accounts` Bank 3,650,000, Wallet 200,000 | AC-TX-13 |
| T-TX-API-12 | API | as above; `GET /api/summary` before/after | `totals` and `income`/`expense` lists equal | AC-TX-14 |
| T-TX-API-13 | API | Wallet 200,000; transfer Wallet → Bank 200,001, then 200,000 | 400 `INSUFFICIENT_FUNDS`, counts unchanged; 201, Wallet 0 | AC-TX-15 |
| T-TX-API-14 | API | Bank → Bank; Bank → bob's Wallet; the §3 transfer body as admin and with no session | 400 `VALIDATION_ERROR`; 404, counts unchanged; 403; 401 | AC-TX-16 |
| T-TRF-UNIT-01 | Unit (client) | `isTransfer` / `transferLabel` for PAYMENT Bank→Wallet, RECEIVE into Bank with Wallet line, PAYMENT Bank→Dining, PAYMENT Card→Bank, mixed CASH+EXPENSE lines | "Transfer: Bank → Wallet", "Transfer: Wallet → Bank", not a transfer ×3 | AC-TX-17 |
| T-TRF-UI-01 | Component | form with Bank, Wallet, Card, Dining | From/To list only Bank, Wallet; To excludes From; Save disabled until complete; sends the §3 body | AC-TX-18 |
| T-TRF-UI-02 | Component | server replies `INSUFFICIENT_FUNDS` | alert shows the message; values kept | AC-TX-15 |
| T-HST-UI-04 | Component | history with a transfer and a payment | only the transfer row labelled "Transfer: Bank → Wallet" | AC-TX-17 |
| T-TX-E2E-02 | E2E | alice: create Wallet, transfer 2,000.00 | dashboard Bank 36,500.00, Wallet 2,000.00; income/expense unchanged | AC-TX-19 |

Regression kept: T-TX-*, T-FUND-*, T-SUM-*, access suite, demo-journey E2E.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Storage | PAYMENT from → one CASH line to; no new kind or flag | Existing rules and balances already correct; no migration; F-12 edit/void works the same for transfers |
| Transfer detection | Derived on the client | No stored flag to keep consistent |
| Transfers to LOAN accounts | Not a transfer — repayments belong to F-08 | Matches `features.md` F-07 note |
| One "to" account per transfer | Yes | Split transfers are unusual; the general form still allows them |

## 9. Definition of Done

- [ ] T-TX-API-11…14 pass (`npm --prefix server test`); T-TRF-UNIT-01, T-TRF-UI-01/02, T-HST-UI-04 pass (`npm --prefix client test`); T-TX-E2E-02 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-TX-03 / FR-SUM-03, `features.md` F-07 status, `traceability.md` rows updated
- [ ] PR into `Sprint-2/staging` reviewed and approved by Jirawat

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-21 | `b6e700a` | #66 / S2-01 (#65) | First draft for review |
| 0.2 | 2026-11-22 | — | #66 review (Jirawat) | Transfer label follows the money for RECEIVE (line → source); AC-TX-16 / T-TX-API-14 add ADMIN 403 and anonymous 401; T-TRF-UNIT-01 adds the RECEIVE case |
