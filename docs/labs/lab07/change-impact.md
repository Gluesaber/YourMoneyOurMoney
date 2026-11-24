# Lab 7 — L7-01 Change impact and contract revision

> **Change request:** Issue L7-01 (#64) — reject a payment or transfer that would overdraw a Cash account (new BR-14).
> **Approval:** Kantapat Suwannahong (TA), **Approved 2026-11-24** via DM, recorded on #64 with a screenshot
> (topic accepted 2026-11-23 with revisions requested; #64 revised the same day).
> **This file and the contract revisions it lists are committed before any L7-01 test or code** and reviewed by
> Jirawat Rachatapramet before the RED commit. Times are Asia/Bangkok (UTC+7).

## 1. Old and new rule

| | Rule | Where |
|---|---|---|
| **Old (Sprint 1, accepted)** | "Overdraft: allowed. A CASH balance may go negative; there is no balance check when saving." | F-04 v1.0 §2, §8; System SDS §4.4 |
| **New (BR-14)** | A new transaction is rejected if it would leave any of the user's CASH accounts with a balance below 0. A CASH account is decreased when it is the source of a PAYMENT or a CASH line of a RECEIVE; lines on one account are summed. Balance = the dashboard balance: opening balance + every recorded transaction, whatever its date. Rejection: 400 `INSUFFICIENT_FUNDS` with `{ accountId, balance, required, shortfall }`; nothing saved (BR-13). | F-04 v1.1 §2 step 7 |

**Scope (as approved on #64):** new transactions only (`POST /api/transactions`), which also covers transfers (F-07),
lending / repaying (F-08) and duplicates (F-10) because they save through it. Edit / delete do not exist in the
product yet (F-12, Sprint 3, will apply BR-14). Opening-balance changes are unchanged (known limitation). LOAN_TAKEN
(credit card / loan) sources keep no limit.

## 2. Versions

| Role | Ref | Commit | Notes |
|---|---|---|---|
| Rule introduced | F-04 v1.0 | `989daea` (S1-10, PR #21) | First released in `v0.1.0` (`d2be6e7`) |
| **Accepted Sprint 1 baseline** | `main` (Lab 6) | `0731479` | Cloud Run `ymom-00007-pkv`; CPMS UAT Accepted 18 Nov |
| Pre-change **deployed** version | `v0.2.0` → `main` | `cd90cb6` → `249eb2d` | `ymom-00008-5rn`, then `ymom-00009-dd6` (23 Nov 11:42) from `249eb2d`, a docs-only change (`evidence.md` §6); same code as `v0.2.0` |
| Pre-change **implementation** modified | `Sprint-3/staging` | `943b463` | `v0.2.0` code + F-11 reports (#90). The F-04 save path is the Sprint 1 one plus the F-06 archived-account check |
| Intervening development (not part of this change) | — | `0731479..943b463` | Sprint 2 F-06…F-10 (#73–#78, `v0.2.0`), Sprint 3 contracts (#89), F-11 reports (#90) |
| Contract commit | `Issue-L7-01` | this commit | this file + F-04 v1.1, SRS, System SDS, traceability |
| RED / GREEN / release / deploy | `Issue-L7-01` → `Sprint-3/staging` → `main` | to record | — |

Earlier baseline run on the Sprint 1 code (tree `0731479`, 21 Nov 19:52): server 187 / 187, client 72 / 72.

## 3. Impact

| Item | Affected? | Detail |
|---|---|---|
| Requirements | **Yes** | New **BR-14**; FR-TX-01 and FR-TX-02 gain a validation rule; FR-TX-05 (all-or-nothing) now also covers the check; FR-TX-03 / FR-TX-09 get their overdraft cases (moved here from F-07 / F-08) |
| Feature contract F-04 | **Yes** | v1.1: §2 new step 7 (save → step 8), §2.1, §3 errors, §6 AC-TX-03 revised + AC-FUND-01…06, §7 T-TX-API-03 revised + T-FUND-*, §8 overdraft decision reversed, §10 |
| Other contracts | **Already moved** | F-07 AC-TX-15 / T-TX-API-13 (v0.3) → T-FUND-API-07; F-08 AC-DEBT-03 / T-DEBT-API-03 (v0.3) → T-FUND-API-08 |
| SRS | **Yes** | §4 BR-14 row and intro; FR-TX-01 / FR-TX-02 validation rules |
| System SDS | **Yes** | §3.3 enforcement row; §4.4 decision; §5.1 error table; §5.3 POST errors |
| Code `server/src/services/ledger.ts` | **Yes** | New pure `checkCashFunds(input, accountsById, balances)`: decrease per CASH account, first account below 0 → `INSUFFICIENT_FUNDS`. `computeBalances`, `validateTransaction` unchanged |
| Code `server/src/routes/transactions.routes.ts` | **Yes** | Inside the existing `prisma.$transaction`: lock the decreased CASH account rows (`SELECT … FOR UPDATE`), load balances with the transaction client, call `checkCashFunds`, then save |
| Code `server/src/services/userLedger.ts` | **Small** | `loadLedger` takes an optional Prisma client so the check reads inside the save transaction; GET routes unchanged |
| Code `server/src/lib/errors.ts` | **Yes** | `INSUFFICIENT_FUNDS` (400) |
| Callers / dependencies | Checked | Only `POST /api/transactions` saves; F-07 Transfer form, F-08 loan forms and F-10 duplicate all call it. `GET /api/accounts`, `/api/summary`, `/api/reports/*` only read and are unchanged |
| UI | **None expected** | Every form already shows the server message in an alert and keeps the entered values (T-TX-UI-02, T-TRF-UI-02, loan form tests); covered again by T-FUND-UI-01 |
| Roles / ownership | Preserved | The check runs after `requireRole("USER")` (ADMIN 403, anonymous 401), after ownership (404) and the F-06 archived check; it reads only the user's own rows, so another user's balance can neither affect nor be revealed by the response |
| Persistence | Preserved | Same rows on success; nothing on rejection (BR-13) |
| Concurrency | **New** | The row lock serialises two payments from the same Cash account. The rule is unit-tested; the lock is reviewed in code (a reliable concurrent API test is out of scope — limitation) |
| Historical data / migration | N/A | Balances are computed, not stored; existing rows and already-negative balances are kept. A negative account still accepts RECEIVEs |
| Precision | Preserved | Integer satang; the boundary is tested at exactly the balance and 1 satang over |

## 4. Behaviour that must not change, and the tests that protect it

| Preserved behaviour | Tests |
|---|---|
| F-04 steps 1–6 rules, order and error codes; F-06 archived check | T-TX-UNIT-01…06, T-TX-API-04…08, T-ACC-API-18, T-FUND-API-05 |
| PAYMENT from a card (LOAN_TAKEN) without limit | T-TX-API-02, T-FUND-API-04 |
| RECEIVE into a CASH account, even a negative one | T-TX-API-01, T-FUND-API-04 |
| Sprint 1 demo journey balances (38,500.00 / 0 / 30,000.00 / 1,500.00) | transactions / summary / history API tests, `e2e/demo-journey.spec.ts` |
| Sprint 2 and Sprint 3 journeys that save through this path | `e2e/transfers.spec.ts`, `loans.spec.ts`, `favorites.spec.ts`, `reports.spec.ts` (all fund Bank first) |
| User isolation (another user's account → 404, nothing stored) | T-TX-API-09, `access.api.test.ts`, T-FUND-API-06 |
| ADMIN 403 / anonymous 401 on financial routes | T-TX-API-10, `access.api.test.ts`, `admin.api.test.ts` |
| All-or-nothing save | T-TX-API-04, T-FUND-API-02 |

**Expected result legitimately revised:** T-TX-API-03 (demo #3, the Bank → Credit Card repayment) posted with Bank at
0 and expected 201; under BR-14 it must first record demo #1 (salary into Bank). Any other existing test that pays
from an unfunded Cash account is listed in the RED / GREEN record with the same reason.

**Regression for the PR:** full server, client and E2E suites (every money journey saves through this path), lint,
format, types and build.

## 5. Revised contract (summary)

The full revised text is in `docs/sprints/sprint-1/F-04-transactions.md` v1.1. New AC and tests:

| AC | Given / When / Then |
|---|---|
| AC-FUND-01 | Given Bank = 1,500.00, PAYMENT from Bank of exactly 1,500.00 → 201 and Bank = 0.00. |
| AC-FUND-02 | Given Bank = 1,500.00, PAYMENT from Bank of 1,500.01 → 400 `INSUFFICIENT_FUNDS`, `shortfall` 1; counts and all balances unchanged. |
| AC-FUND-03 | A RECEIVE whose CASH line(s) would take that account below 0 (lines on one account summed) → 400 `INSUFFICIENT_FUNDS` naming that account. |
| AC-FUND-04 | PAYMENT from Credit Card (LOAN_TAKEN) of any valid amount → 201; RECEIVE into a CASH account → 201 even if it is negative. |
| AC-FUND-05 | Steps 1–6 (and the F-06 archived check) take priority over `INSUFFICIENT_FUNDS`; another user's account → 404; ADMIN → 403; anonymous → 401. |
| AC-FUND-06 | In the form, an overdrawing payment shows the server's message and keeps the entered values. |

Tests: T-FUND-UNIT-01…03, T-FUND-API-01…09, T-FUND-UI-01 (F-04 v1.1 §7). T-FUND-API-07 and T-FUND-API-08 are the
overdraft cases moved from F-07 (AC-TX-15) and F-08 (AC-DEBT-03).

## 6. Review before implementation

Reviewer: Jirawat Rachatapramet — recorded on the contract PR before the RED commit is pushed.
