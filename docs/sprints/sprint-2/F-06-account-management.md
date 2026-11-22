# F-06 — Custom Account & Category Management (Sprint 2 contract)

> **Status:** v0.4 — v0.2 reviewed in #66; implemented in #73 (S2-02, #67); v0.4 from the #73 review (§10).
> **Requirements:** FR-ACC-02, FR-ACC-03, FR-ACC-04, FR-ACC-06 · BR-03, BR-04, BR-12 · new BR-15, BR-16
> **Builds on:** F-03 (accounts, opening balances), `docs/system-sds.md` §3 (data model), §4 (balances), §5 (API).
> **Written against:** BR-14 (Lab 7 L7-01, no Cash overdraft) — assumes L7-01 is merged first.

## 1. Behaviour

A user manages their own accounts ("categories" are the INCOME and EXPENSE accounts):

- **Create** an account with a name, type and optional subtype (e.g. a second Cash account "Wallet", an expense
  "Transport", a LOAN_GIVEN "Lent to Ben").
- **Edit** an account's name; change its type/subtype only while no transaction uses it.
- **Archive** an account so it can no longer be used in new transactions, while its history and balance stay
  visible; **unarchive** it again.
- **Delete** an account that no transaction has ever used (e.g. one created by mistake).
- Opening balances keep using F-03 `PUT /api/accounts/:id/opening-balance` (no change in this feature).

Seeded accounts (F-03 §1.1) are ordinary accounts: they can be renamed, archived or deleted under the same rules.

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | A user sees and changes only their own accounts | BR-04 | 404 `NOT_FOUND` |
| R2 | `name` is trimmed, 1 … 50 characters | FR-ACC-03 | 400 `VALIDATION_ERROR` |
| R3 | Names are unique per user, ignoring case and surrounding spaces ("bank" clashes with "Bank") | FR-ACC-03 | 409 `ACCOUNT_NAME_TAKEN` |
| R4 | `type` ∈ CASH, LOAN_TAKEN, LOAN_GIVEN, INCOME, EXPENSE; `subtype`: CASH → BANK / WALLET / null; LOAN_TAKEN → CREDIT_CARD / null; others → null. On `PATCH`, changing `type` without sending `subtype` resets `subtype` to null; a `subtype` that is sent must fit the new type | FR-ACC-02 | 400 `VALIDATION_ERROR` |
| R5 | `type`/`subtype` can change only while no transaction uses the account (as source or line) | FR-ACC-06, new BR-15 | 400 `CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS` |
| R6 | Changing the type to INCOME or EXPENSE requires `openingBalance` = 0 | BR-12 | 400 `INVALID_ACCOUNT_TYPE` |
| R7 | An archived account cannot be the source or a line of a new transaction, and its opening balance cannot be changed (`PUT /api/accounts/:id/opening-balance`), so an archived account never gains a balance | new BR-16 | 400 `ACCOUNT_ARCHIVED`, details `{ field, lineIndex?, accountId }` |
| R8 | A CASH / LOAN_TAKEN / LOAN_GIVEN account can be archived only when its balance is 0 (no money or debt hidden) | new BR-16 | 400 `ACCOUNT_NOT_EMPTY`, details `{ balance }` |
| R9 | An account can be deleted only if no transaction has ever used it | FR-ACC-06 | 409 `ACCOUNT_IN_USE` |
| R10 | At most 100 accounts per user (archived included) | bounded input | 400 `VALIDATION_ERROR` |

Validation order for each route: path id → body shape (R2, R4, R10) → ownership (R1) → R3 → R5/R6/R8/R9.
A non-numeric `:id` is 404 (as F-03).

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| zod schemas | `server/src/routes/accounts.routes.ts` |
| subtype/type rules (R4, R6) | pure function `validateAccountShape` in `server/src/services/accounts.ts` (unit-tested) |
| in-use / balance checks (R5, R8, R9) | route, using `loadLedger` (`userLedger.ts`) and a transaction/line count |
| archived check in transactions (R7) | `POST /api/transactions` step 2 (after ownership, before type checks) |

## 3. API

All routes: `requireUser, requireRole("USER")`. Anonymous → 401; ADMIN → 403.

```
POST   /api/accounts            { name, type, subtype? }           → 201 { account: Account }
PATCH  /api/accounts/:id        { name?, type?, subtype? } (≥1)    → 200 { account }
PATCH  /api/accounts/:id/archive { archived: boolean }             → 200 { account }
DELETE /api/accounts/:id                                           → 204
GET    /api/accounts            (unchanged order, F-03 §3)         → 200 { accounts: Account[] }

Account = F-03 shape + "archived": boolean + "inUse": boolean   // inUse: a source or line of any transaction (R5, R9)
Errors: 400 VALIDATION_ERROR | INVALID_ACCOUNT_TYPE | CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS |
        ACCOUNT_NOT_EMPTY · 409 ACCOUNT_NAME_TAKEN | ACCOUNT_IN_USE · 401 · 403 · 404
POST /api/transactions gains: 400 ACCOUNT_ARCHIVED
```

New error codes added to `server/src/lib/errors.ts` and `system-sds.md` §5.1: `ACCOUNT_NAME_TAKEN`,
`CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS`, `ACCOUNT_ARCHIVED`, `ACCOUNT_NOT_EMPTY`, `ACCOUNT_IN_USE`.

## 4. Data

Migration `add_account_archived_at`: `Account.archivedAt DateTime?` (null = active). No data change for existing
rows (all active). Case-insensitive uniqueness (R3): unique index `Account_userId_lower_name_key` on `(userId, lower(name))`,
hand-written in the migration (Prisma cannot declare an expression index), **added alongside** the existing
`@@unique([userId, name])` — keeping the exact index leaves Prisma's `userId_name` lookups (seed, test helpers)
working. Existing data has no case-only duplicates (seeded names don't).
Delete (R9) is also backed by the existing `onDelete: Restrict` foreign keys from Transaction / TransactionLine.
Balances, income/expense totals: unchanged rules (system-sds §4.1); archived accounts still count.

## 5. UI

- **Accounts page (`/accounts`)**, linked from the dashboard: table of accounts grouped by type, with balance,
  Archived badge, and actions Rename / Change type (hidden once used) / Archive or Unarchive / Delete (only when
  unused). "Used" comes from `inUse` in `GET /api/accounts`; the server still enforces R5 and R9. While an action is
  saving, that row's buttons are disabled. Server errors appear in an alert.
- **New account form**: Name, Type, Subtype (options depend on type). Save → back to `/accounts`.
- **Transaction form** (`TransactionFormPage.tsx`): archived accounts are not offered in source/line selects.
- **Dashboard**: archived accounts with balance 0 are hidden; summary totals unchanged.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-ACC-12 | When alice creates CASH/WALLET "Wallet", then 201, and `GET /api/accounts` lists it with balance 0, `archived: false`. |
| AC-ACC-13 | When alice creates EXPENSE "Transport", she can record a PAYMENT to it and the summary expense list includes it. |
| AC-ACC-14 | When the name is empty, only spaces, or 51 characters, type/subtype is invalid (e.g. EXPENSE + BANK), or the user already has 100 accounts (archived included), then 400 `VALIDATION_ERROR` and nothing is created. A type change without `subtype` resets `subtype` to null. |
| AC-ACC-15 | When alice creates or renames to " bank " while "Bank" exists, then 409 `ACCOUNT_NAME_TAKEN`; bob may still create "Wallet" when alice has one. |
| AC-ACC-16 | When alice renames an account used by transactions, then 200 and history shows the new name. |
| AC-ACC-17 | When she changes the type of an unused account, 200; of a used account, 400 `CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS`; to INCOME/EXPENSE with a non-zero opening balance, 400 `INVALID_ACCOUNT_TYPE`. |
| AC-ACC-18 | When she archives an EXPENSE account, or a CASH account with balance 0, then 200; a CASH account with balance ≠ 0 → 400 `ACCOUNT_NOT_EMPTY`. |
| AC-ACC-19 | When a transaction uses an archived account as source or line, or the user sets the opening balance of an archived account, then 400 `ACCOUNT_ARCHIVED` and nothing is saved; after unarchive both are accepted. |
| AC-ACC-20 | When she deletes an unused account, 204 and it is gone; a used account → 409 `ACCOUNT_IN_USE` and it remains. |
| AC-ACC-21 | Any F-06 route on bob's account or a missing id → 404 and bob's account unchanged; anonymous 401; ADMIN 403. |
| AC-ACC-22 | Through the UI alice creates "Wallet", sees it on the dashboard, and can pick it as a payment source. |
| AC-ACC-23 | `GET /api/accounts` reports `inUse` for every account (false until it is a source or a line). On the Accounts page a used account offers no Delete and no type change, an unused one offers both, and a row's buttons are disabled while its action is saving. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-ACC-UNIT-01 | Unit (table) | `validateAccountShape` for every type × subtype pair | allowed pairs pass; others `VALIDATION_ERROR` | AC-ACC-14 |
| T-ACC-API-11 | API | `resetDb()`; alice POST Wallet (CASH/WALLET) | 201; listed with balance 0 | AC-ACC-12 |
| T-ACC-API-12 | API | alice POST Transport (EXPENSE); PAYMENT Card → Transport 10,000 | 201; summary expense includes Transport 10,000 | AC-ACC-13 |
| T-ACC-API-13 | API (table) | names `""`, `"   "`, 51 chars; EXPENSE+BANK; CASH+CREDIT_CARD; unknown type; 101st account; PATCH unused Wallet (CASH/WALLET) to `{ type: "LOAN_TAKEN" }`, then `{ type: "CASH", subtype: "CREDIT_CARD" }` | each create 400 `VALIDATION_ERROR`, count unchanged; PATCH 200 with `subtype` null, then 400 | AC-ACC-14 |
| T-ACC-API-14 | API | alice POST `" bank "`; PATCH Dining name `"BANK"`; bob POST "Wallet" after alice has one | 409, 409, 201 | AC-ACC-15 |
| T-ACC-API-15 | API | demo journey; rename Dining → "Eating out"; GET transaction | 200; line name "Eating out" | AC-ACC-16 |
| T-ACC-API-16 | API | type change on unused / used / opening-balance ≠ 0 account | 200 / 400 `CANNOT_CHANGE…` / 400 `INVALID_ACCOUNT_TYPE` | AC-ACC-17 |
| T-ACC-API-17 | API | archive Telecom; archive Wallet at 0; archive Bank at 38,500.00 | 200, 200, 400 `ACCOUNT_NOT_EMPTY` | AC-ACC-18 |
| T-ACC-API-18 | API | archived Telecom as line; archived Wallet as source; `PUT` opening balance 100,000 on archived Wallet; unarchive; retry all three | 400 `ACCOUNT_ARCHIVED` ×3, counts and Wallet opening balance unchanged; 201, 201, 200 | AC-ACC-19 |
| T-ACC-API-19 | API | DELETE unused Wallet; DELETE used Dining | 204; 409 `ACCOUNT_IN_USE`, Dining remains | AC-ACC-20 |
| T-ACC-API-20 | API (table) | alice on bob's account for every F-06 route; id 999999 / `abc`; anon; admin | 404 / 404 / 401 / 403; bob unchanged | AC-ACC-21 |
| T-ACC-DB-01 | DB | insert case-only duplicate name directly | unique-index violation | AC-ACC-15 |
| T-ACC-UI-04 | Component | new-account form: type EXPENSE hides subtype; server 409 | subtype hidden; alert shows message | AC-ACC-14, 15 |
| T-ACC-API-21 | API | `resetDb()`; Wallet created; GET; record PAYMENT Card → Dining; GET | every account has `inUse`; Wallet, Dining, Card false then Dining and Card true, Wallet still false | AC-ACC-23 |
| T-ACC-UI-05 | Component | Accounts page with one used and one unused account; slow archive request | used: no Delete, edit row has no Type select; unused: both; row buttons disabled until the request ends | AC-ACC-23 |
| T-ACC-E2E-02 | E2E | alice creates Wallet, records PAYMENT from Wallet after funding it | Wallet on dashboard with the right balance | AC-ACC-22 |

Regression kept: all T-ACC-API-01…10, T-TX-API-*, T-SUM-*, access suite T-ADM-API-04 (now including F-06 routes).

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Archive vs delete | Both: archive any time if empty; delete only if never used | SRS FR-ACC-06 mentions archive of unused accounts; archive-when-used keeps history readable, delete covers mistakes. **SRS FR-ACC-06 text to be revised to match.** |
| Archive needs balance 0 (R8) | Yes for CASH/LOAN_* | Prevents money or debt disappearing from the dashboard |
| Name uniqueness | Case-insensitive, per user | "Bank" and "bank" would be indistinguishable in selects |
| Status code for name clash / in use | 409 | Conflict with existing state, not a malformed request |
| Opening balance edits | Unchanged (F-03 route) | Out of F-06 scope; BR-14 interaction with lowering an opening balance is an open question (L7-01 known limitation) |
| Account limit | 100 per user | Bounded input |

## 9. Definition of Done

- [ ] T-ACC-UNIT-01, T-ACC-API-11…21, T-ACC-DB-01 pass (`npm --prefix server test`); T-ACC-UI-04, T-ACC-UI-05 pass (`npm --prefix client test`); T-ACC-E2E-02 passes
- [ ] Each rule test seen failing before implementation (RED commit before GREEN)
- [ ] Migration applies cleanly on a copy of the current data (`prisma migrate deploy`) and through the Lab 5 pipeline
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-ACC-06 / BR table, System SDS §3 / §5, `traceability.md` updated
- [ ] PR into `Sprint-2/staging` reviewed and approved by Jirawat

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-21 | `b6e700a` | #66 / S2-01 (#65) | First draft for review |
| 0.2 | 2026-11-22 | `14571a7` | #66 review (Jirawat) | Test ID T-ACC-UI-03 → T-ACC-UI-04 (03 exists, #60); R7 also blocks opening-balance changes on archived accounts; R4 type change without `subtype` resets it to null; AC-ACC-14 states the 100-account limit; T-ACC-API-13 and T-ACC-API-18 extended |
| 0.3 | 2026-11-22 | `97ab00d` | #73 / S2-02 (#67) implementation | §4: the case-insensitive index is added alongside `@@unique([userId, name])` instead of replacing it |
| 0.4 | 2026-11-22 | — | #73 review follow-up (S2-02) | §3 adds `inUse` to every account so the Accounts page can hide Delete and type change for used accounts as §5 already required; §5 row buttons disabled while saving; AC-ACC-23, T-ACC-API-21, T-ACC-UI-05 added |
