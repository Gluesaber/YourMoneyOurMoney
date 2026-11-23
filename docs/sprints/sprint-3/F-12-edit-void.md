# F-12 — Transaction Editing, Voiding & Corrections (Sprint 3 contract)

> **Status:** v0.1 draft for review (contract Issue S3-01 #83; implementation Issue S3-03 (#85)). Merged before any F-12 code.
> **Requirements:** FR-TX-10, FR-TX-01, FR-TX-02, FR-TX-05 · BR-01, BR-02, BR-04, BR-05, BR-09, BR-10, BR-11, BR-13, BR-14 · new BR-17
> **Depends on:** F-04 (validation steps), F-05 (balances), F-06 (archived accounts, `inUse`), F-09 (`transactionQuery.ts`),
> F-10 (favorites), L7-01 / BR-14 (awaiting TA approval on #64 — if BR-14 is not adopted, the BR-14 parts of this
> contract are dropped by a versioned revision).
> **IDs:** `AC-VOID-01…`, `T-VOID-API-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

- **Edit:** the user corrects a recorded transaction — date, note, total, source and lines (kind stays the same).
  The edit replaces the old version completely and is validated exactly like a new transaction.
- **Void:** the user cancels a wrongly entered transaction. It stays in history marked **Voided** (with the void
  time) but no longer affects any balance, summary, report or export total. A voided transaction cannot be edited
  or un-voided; the user records a new one instead.

Balances are always computed from the non-voided transactions (`system-sds.md` §4.1), so they update immediately.

## 2. Rules and validation

`PUT /api/transactions/:id` runs, in order:

| Step | Check | Source | Error |
|---|---|---|---|
| 0 | `:id` positive integer; transaction exists, is the user's | BR-04 | 404 `NOT_FOUND` |
| 1 | Body = F-04 step 1 shape; `kind` must equal the stored kind | FR-TX-10 | 400 `VALIDATION_ERROR` (`kind` → "Kind cannot change; void and re-enter instead.") |
| 2 | Transaction not voided | new BR-17 | 400 `TRANSACTION_VOIDED` |
| 3–7 | F-04 steps 2–7 (ownership, types, source not a line, sum = total, archived accounts, BR-14) | F-04 | as F-04 |
| 8 | Replace the transaction row and all its lines in one `prisma.$transaction` | BR-13 | nothing changed on any error |

`DELETE /api/transactions/:id` (void) runs: step 0 → step 2 (already voided → 400 `TRANSACTION_VOIDED`) →
BR-14 → set `voidedAt = now()` in one database transaction.

**BR-14 on corrections:** the balance check uses the ledger **without the old version** of this transaction:
an edit or void is rejected if, after it, a CASH account whose balance goes down would be below 0. Example:
voiding the salary RECEIVE when Bank has already been spent → `INSUFFICIENT_FUNDS`. The archived-account check
applies only to accounts newly added by the edit; keeping an already-used archived account is allowed.

| # | Other rules | Source |
|---|---|---|
| R1 | `isFavorite` and `createdAt` are kept on edit; voiding clears `isFavorite` | FR-TX-07 |
| R2 | Voided transactions are excluded from balances, summary, reports and export totals, and from F-09 results unless `includeVoided=true` | BR-17 |
| R3 | Duplicating (F-10) a voided transaction is allowed (it is a new transaction) | F-10 |
| R4 | ADMIN 403, anonymous 401 | BR-05 |
| R5 | A voided transaction still counts for F-06 `inUse` (its rows still reference the accounts, so they cannot be deleted or change type) | F-06 R5, R9 |

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| Voided filter + `includeVoided` param | `server/src/lib/transactionQuery.ts` (F-09 parser): `voidedAt: null` unless `includeVoided=true` |
| Shared validate-and-check pipeline (F-04 steps 2–7) | extracted from `POST /` into `server/src/services/transactionWrite.ts`, used by POST, PUT and DELETE |
| `computeBalances` excludes voided rows / the edited id | `loadLedger(userId, { client, excludeTransactionId })` in `userLedger.ts`; voided filtered in every query |
| Edit / void UI | `TransactionDetailPage.tsx` (Edit, Void buttons), `TransactionFormPage.tsx` in edit mode (`/transactions/:id/edit`) |

## 3. API

```
PUT /api/transactions/:id      body = F-04 POST body (same kind)
→ 200 { "transaction": Transaction }
→ 400 VALIDATION_ERROR | ALLOCATION_MISMATCH | INVALID_ACCOUNT_TYPE | INSUFFICIENT_FUNDS | ACCOUNT_ARCHIVED | TRANSACTION_VOIDED
→ 401 · 403 · 404

DELETE /api/transactions/:id
→ 200 { "transaction": Transaction }     // with voidedAt set
→ 400 TRANSACTION_VOIDED | INSUFFICIENT_FUNDS · 401 · 403 · 404

Transaction shape gains: "voidedAt": "2026-12-02T10:15:00.000Z" | null, "updatedAt": ISO string
// Legitimate change to existing expected results: the strict shape tests on GET /api/transactions and
// GET /api/transactions/:id (T-TX-API-01, T-HST-API-*, history/transfer/favorite tests) gain these two fields.
```

New error code `TRANSACTION_VOIDED` (400) in `errors.ts` and `system-sds.md` §5.1.

## 4. Data

Migration `add_transaction_void_and_update`: `Transaction.voidedAt DateTime?`, `Transaction.updatedAt DateTime
@updatedAt` (backfilled = `createdAt`). Existing rows: `voidedAt` null — all stay active. Lines are replaced by
delete + insert inside the same database transaction. No edit history table (§8).

## 5. UI

- Detail page: **Edit** and **Void** buttons (hidden when voided). Voided transactions show a "Voided on …" badge
  and greyed amounts; history rows the same.
- Edit opens the transaction form pre-filled, heading "Edit transaction #id", kind fixed; Save → detail page.
- Void asks for confirmation ("This removes it from all balances. This cannot be undone."); server errors
  (e.g. `INSUFFICIENT_FUNDS`) shown in the alert.
- History: "Show voided" toggle (F-09 `includeVoided=true`).

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-VOID-01 | Editing the card purchase from Dining 90,000 + Groceries 60,000 to Dining 100,000 + Groceries 60,000 (total 160,000) → 200; Card debt, Dining and expense totals reflect the new values; the old lines are gone. |
| AC-VOID-02 | An edit that breaks any F-04 rule (lines ≠ total, wrong type, source as line, bob's account, archived new account, overdraft) or changes `kind` → that error, and the stored transaction and every balance are unchanged. |
| AC-VOID-03 | Voiding a transaction → 200 with `voidedAt`; balances, summary and reports no longer include it; it is still in history with `includeVoided=true`; editing or voiding it again → 400 `TRANSACTION_VOIDED`. |
| AC-VOID-04 | Voiding (or editing) that would leave a CASH account below 0 → 400 `INSUFFICIENT_FUNDS`, nothing changed; at exactly 0 → accepted. |
| AC-VOID-05 | PUT/DELETE on bob's, a missing or a non-numeric id → 404 and bob's row unchanged; ADMIN 403; anonymous 401. |
| AC-VOID-06 | In the UI the user edits a note and the amount of a transaction and voids another after confirming; the dashboard reflects both. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-VOID-UNIT-01 | Unit | `computeBalances` with a voided transaction and with `excludeTransactionId` | voided/excluded rows contribute nothing | AC-VOID-03, 04 |
| T-VOID-API-01 | API | demo journey; PUT card purchase to 100,000 + 60,000 | 200; Card 10,000 (160,000 − 150,000 repaid); Dining 100,000; expense total 160,000; 2 lines stored | AC-VOID-01 |
| T-VOID-API-02 | API (table) | PUT with lines ≠ total; Salary line in PAYMENT; source as line; bob's line; kind RECEIVE; archived new account; overdraft | each F-04 error; stored row, lines and balances unchanged | AC-VOID-02 |
| T-VOID-API-03 | API | void the card repayment; GET accounts/summary; GET transactions with/without `includeVoided`; void again; PUT it | Bank +150,000, Card +150,000; listed only with flag; 400 `TRANSACTION_VOIDED` ×2 | AC-VOID-03 |
| T-VOID-API-04 | API | (a) Bank opening 0; RECEIVE Salary 100,000; PAYMENT Bank → Dining 100,000; void the RECEIVE. (b) fresh DB: RECEIVE 100,000; PAYMENT 40,000; void the RECEIVE. (c) fresh DB: RECEIVE 100,000 only; void it | (a) 400 `INSUFFICIENT_FUNDS`, shortfall 100,000; (b) 400, shortfall 40,000; (c) 200, Bank 0 | AC-VOID-04 |
| T-VOID-API-05 | API | Bank: RECEIVE 100,000, PAYMENT 60,000; PUT the PAYMENT to 100,000 / 100,001 | 200 (Bank 0) / 400 `INSUFFICIENT_FUNDS` | AC-VOID-04 |
| T-VOID-API-06 | API (table) | PUT/DELETE bob's tx, 999999, `abc`; admin; anon | 404 ×3 (bob unchanged); 403; 401 | AC-VOID-05 |
| T-VOID-DB-01 | DB | migration on a copy with Sprint 1/2 rows | all `voidedAt` null, `updatedAt` = `createdAt` | §4 |
| T-VOID-UI-01 | Component | edit mode form; void confirm dialog; server `INSUFFICIENT_FUNDS` | pre-filled, kind fixed; nothing sent until confirmed; alert shown | AC-VOID-06 |
| T-VOID-E2E-01 | E2E | as AC-VOID-06 | dashboard values match | AC-VOID-06 |

Regression kept: all T-TX-*, T-FUND-*, T-SUM-*, T-HST-*, T-REP-* (voided excluded), access suite with the two new routes.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Void vs delete | Soft void (`voidedAt`), never hard delete | Keeps an audit trail; history still shows what was entered |
| Kind change on edit | Not allowed | A payment turning into a receive is a different transaction; void + re-enter is clearer |
| Edit history | Not stored (only `updatedAt`) | Bounded scope; recorded as a limitation |
| BR-14 on corrections | Applies, using the ledger without the old version | Otherwise an edit or void could create the overdraft BR-14 forbids |
| Un-void | Not supported | Duplicate (F-10) covers re-entering |

## 9. Definition of Done

- [ ] T-VOID-UNIT-01, T-VOID-API-01…06, T-VOID-DB-01 pass (`npm --prefix server test`); T-VOID-UI-01 passes (`npm --prefix client test`); T-VOID-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Migration applies through the Lab 5 pipeline; lint, format, type check pass; existing regression green
- [ ] SRS FR-TX-10 and BR-17, System SDS §3/§4/§5, `traceability.md` updated
- [ ] PR into `Sprint-3/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-23 | — | S3-01 (#83) | First draft for review (drafted 2026-11-22, refreshed against the Sprint 2 code 2026-11-23) |
