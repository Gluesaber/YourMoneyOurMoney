# Sprint 2 — Deliverable 2 Evidence and Index

> Source for the Sprint 2 parts of the Deliverable 2 PDF and an index of where they live in the repository.
> **Code tested:** `Sprint-2/staging` @ `a8d6b06` (see `test-results.md`) · **Sprint 2 release on `main`:** recorded in
> §6 after the release PR (S2-07, #72) · Times are Asia/Bangkok (UTC+7).

## 1. Index (Deliverable 2 parts covered by Sprint 2)

| Part | Repository source | Key IDs |
|---|---|---|
| A. Sprint 1 continuity and change status | `test-results.md` §2.3 (demo journey E2E), `docs/sprints/plan.md` §6, `integration.md` §5–6 | `v0.1.0`, `0731479`, #59, #60, L7-01 (#64) |
| B. Sprint 2 contracts and working increment | `docs/sprints/sprint-2/F-06…F-10-*.md`, this file §2–§4, `integration.md`, `test-results.md` | AC-ACC-12…23, AC-TX-13…19, AC-DEBT-01…07, AC-HST-04…08, AC-FAV-01…06 |
| D. Requirements and traceability (Sprint 2 rows) | `docs/srs.md`, `docs/features.md`, `docs/system-sds.md`, `docs/traceability.md` | FR-ACC-06, FR-TX-03, FR-TX-07…09, FR-HST-03, BR-15, BR-16 |
| E. Release candidate (Sprint 2 part) | §6 below, `test-results.md` | release commit, CI run, Cloud Run revision |

## 2. Sprint 2 completion table

All results are from the run on `a8d6b06` (`test-results.md`). "Release" is filled in §6 once `main` is released.

| Feature | AC | Implementation | Executed verification | Result |
|---|---|---|---|---|
| **F-06** Custom accounts & categories (#67) | AC-ACC-12…22 | `accounts.routes.ts` (POST / PATCH / archive / DELETE), `services/accounts.ts`, migration `add_account_archived_at`, `AccountsPage`, `NewAccountPage` | T-ACC-UNIT-01, T-ACC-API-11…20, T-ACC-DB-01, T-ACC-UI-04, T-ACC-E2E-02 | Pass |
| | AC-ACC-23 (`inUse`, follow-up #76) | `inUse` in `GET /api/accounts`; Delete / type change hidden for used accounts | T-ACC-API-21, T-ACC-UI-05 | Pass |
| **F-07** Transfers (#68) | AC-TX-13, 14, 16, 17, 18, 19 | `TransferFormPage`, `lib/transactions.ts` (`isTransfer`, `transferLabel`), dashboard Transfer button; no server change | T-TX-API-11, 12, 14, T-TRF-UNIT-01, T-TRF-UI-01…03, T-HST-UI-04, T-TX-E2E-02 | Pass |
| | AC-TX-15 (overdraft) | — | moved to L7-01 (#64) by contract v0.3 | Deferred, awaiting TA approval |
| **F-08** Lending & borrowing (#69) | AC-DEBT-01, 02, 04, 05, 06, 07 | `LoansPage`, `LoanActionPage`, `lib/loans.ts`; no server change | T-DEBT-API-01, 02, 04, T-DEBT-UNIT-01, T-DEBT-UI-01…02, T-DEBT-E2E-01 | Pass |
| | AC-DEBT-03 (overdraft) | — | moved to L7-01 (#64) by contract v0.3 | Deferred, awaiting TA approval |
| **F-09** Search, filter, sort (#70) | AC-HST-04…08 | `lib/transactionQuery.ts`, `GET /api/transactions` query params + `truncated`, `TransactionFilterBar`, `lib/dateRanges.ts` | T-HST-UNIT-01…02, T-HST-API-04…09, T-HST-UI-02, T-HST-E2E-01 | Pass |
| **F-10** Favorites & duplicate (#71) | AC-FAV-01, 02, 03, 05, 06 | `PATCH /api/transactions/:id/favorite`, `favorite=true`, star toggle, Favorites card, duplicate draft | T-FAV-API-01…03, T-FAV-UNIT-01, T-FAV-UI-01…03, T-ADM-API-04, T-FAV-E2E-01 | Pass |
| | AC-FAV-04 (duplicate breaking a rule) | archived accounts left blank; server errors shown | T-FAV-UI-02 | Pass for the archived case; the insufficient-funds rule itself arrives with L7-01 |

**Scope revisions (recorded before code):** AC-TX-15 and AC-DEBT-03 depend on BR-14 (no Cash overdraft), which is
the Lab 7 change request L7-01 (#64) and awaits TA approval. They were moved to L7-01 by contract revisions F-07 v0.3
(`ca95736`) and F-08 v0.3 (`7bf378c`), each committed before that feature's tests; `docs/sprints/plan.md` §6.

## 3. Contract before code

| Feature | Contract merged (reviewed) | Revision before code | RED commit | GREEN commit |
|---|---|---|---|---|
| F-06 | v0.2, PR #66 (`abc1ee5`, 08:31) | — | `9dc8bf6` | `67604e7` |
| F-07 | v0.2, PR #66 | v0.3 `ca95736` | `de09a41` | `df91929` |
| F-08 | v0.2, PR #66 | v0.3 `7bf378c` | `e129021` | `00f404f` |
| F-09 | v0.2, PR #66 | — | `cb94f7c` | `74ee1dd` |
| F-10 | v0.1, PR #66 | — | `961ccb6` | `7d4f87e` |
| F-06 / F-07 follow-ups | v0.4 `dc93515` | — | `106661e` | `49f8aa7` |

F-07, F-08 change no server code (the API already accepted Cash and loan lines), so their server tests pass before
the feature code; their RED evidence is in the client and E2E tests, as each contract's §7 note states.

## 4. Two selected Issue / PR chains

| | F-06 accounts (Track B) | F-09 search (Track A) |
|---|---|---|
| Issue | S2-02 (#67) | S2-05 (#70) |
| Branch | `Issue-S2-02` | `Issue-S2-05` |
| Commits | RED `9dc8bf6` → GREEN `67604e7` → docs `97ab00d` → `fe3d0ec` | RED `cb94f7c` → GREEN `74ee1dd` → docs `19754e4` → docs fix `c46fd8d` |
| Author → reviewer | Harit Chaiyanukit → Jirawat Rachatapramet | Jirawat Rachatapramet → Harit Chaiyanukit |
| Review | Approved; non-blocking notes (hide Delete / type for used accounts, busy buttons, row order) fixed in #76 | Changes requested (E2E wrongly credited to CI, traceability status, contract header) → fixed in `c46fd8d` → approved |
| CI | `test-and-docker` pass | `test-and-docker` pass |
| Staging | PR #73 → `c09f4ad`, 22 Nov 12:05 | PR #77 → `2d9ce7c`, 22 Nov 15:59 |
| Release | §6 | §6 |

## 5. Contribution

| Member | Sprint 2 work |
|---|---|
| Harit Chaiyanukit (67070501047), Track B | Contracts F-06…F-10 (S2-01, #66); F-06 (#73), F-07 (#74), review follow-ups (#76); reviews of #75, #77, #78; S2-07 integration record |
| Jirawat Rachatapramet (67070501057), Track A | Review of the contracts (#66) and of #73, #74, #76; F-08 (#75), F-09 (#77), F-10 (#78) including the F-08 label / date-field fix |

## 6. Sprint 2 release

Filled in after the release PR `Sprint-2/staging → main` (S2-07, #72): release PR, merge commit on `main`, tag, CI run,
Deploy demo run, Cloud Run revision and the post-deploy check of a critical journey and persistence.

## 7. Known limitations

See `integration.md` §6: the two overdraft AC wait for L7-01; E2E is local only (not in CI) and Chromium-only; manual
cross-checks for Sprint 2 not yet recorded.
