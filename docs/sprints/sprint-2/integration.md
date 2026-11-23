# Sprint 2 — Integration and System Test Record (S2-07)

> **Integrated code:** `Sprint-2/staging` @ `a8d6b06` (2026-11-22, after PR #78). Times are Asia/Bangkok (UTC+7).
> **Accepted Sprint 1 baseline:** `v0.1.0` (`d2be6e7`), re-accepted in Lab 6 UAT on `main` @ `0731479`.

## 1. What is integrated

| PR | Issue | Feature | Author → reviewer | Merged into `Sprint-2/staging` |
|---|---|---|---|---|
| #66 | S2-01 (#65) | Contracts F-06 … F-10 (v0.1 → v0.2 after review) | Harit → Jirawat (changes requested, then approved) | 22 Nov 15:31, `abc1ee5` |
| #73 | S2-02 (#67) | F-06 Custom account & category management | Harit → Jirawat | 22 Nov 19:05, `c09f4ad` |
| #74 | S2-03 (#68) | F-07 Internal transfers between Cash accounts | Harit → Jirawat | 22 Nov 21:36, `dc36389` |
| #75 | S2-04 (#69) | F-08 Lending and borrowing | Jirawat → Harit | 22 Nov 22:14, `abb24cd` |
| #76 | — (links #67, #68) | F-06 / F-07 review follow-ups | Harit → Jirawat | 22 Nov 22:30, `f01b355` |
| #77 | S2-05 (#70) | F-09 Search, filtering and sorting | Jirawat → Harit (changes requested, then approved) | 22 Nov 22:59, `2d9ce7c` |
| #78 | S2-06 (#71) | F-10 Favorites and duplicate (+ F-08 label / date-field fix `fea600c`) | Jirawat → Harit | 22 Nov 23:31, `a8d6b06` |

Every feature PR has a contract (or contract revision) commit and a RED test commit before its GREEN commit; the
commit lists are in `evidence.md` §4.

## 2. Automated results on the integrated code

Full record: `test-results.md`. On `a8d6b06`: server 265 / 265, client 110 / 110, E2E 12 / 12, lint · format ·
types · client build clean, 0 skipped. The Sprint 1 demo journey E2E (Bank 38,500.00, card 0, income 30,000.00,
expense 1,500.00), the BR-01 rejected case and the BR-04 / BR-05 access case all still pass, unchanged.

## 3. Cross-feature checks

Where a Sprint 2 feature touches older behaviour, shared data or another Sprint 2 feature:

| Interaction | What must hold | Covered by | Result |
|---|---|---|---|
| F-06 archived accounts × F-04 save path | archived source / line → 400 `ACCOUNT_ARCHIVED`, nothing saved; another user's archived account still 404 | T-ACC-API-18, T-ACC-API-20 | Pass |
| F-06 archived accounts × F-07 / F-08 / F-04 forms | archived accounts are not offered as From / To / cash / line accounts | T-TRF-UI-01, `loansPage.test.tsx`, `TransactionFormPage` filter | Pass |
| F-06 new accounts × F-05 summary | a new EXPENSE category appears in the summary; archived empty accounts drop off without changing totals | T-ACC-API-12, T-ACC-E2E-02 | Pass |
| F-07 transfers / F-08 loans × BR-08 income / expense | transfers, lending, borrowing and repayments never change income, expense or category totals | T-TX-API-12, T-TX-E2E-02, T-DEBT-API-01, T-DEBT-API-02 | Pass |
| F-06 `inUse` × F-04 transactions | an account becomes `inUse` once it is a source or a line; Delete / type change hidden then | T-ACC-API-21, T-ACC-UI-05 | Pass |
| F-09 filters × F-07 / F-08 records | `accountId` finds a transaction whether the account is its source or a line (transfers, loans) | T-HST-API-05; Loans page History link | Pass |
| F-10 duplicate × F-04 / F-06 rules | a duplicate is a new POST through every F-04 rule; archived accounts are left blank | T-FAV-UI-02, T-FAV-E2E-01 | Pass |
| F-10 `favorite=true` × F-09 query parser | combines with the F-09 filters; invalid values → 400 | T-FAV-API-03 | Pass |
| All new routes × access control | another user's records → 404; ADMIN → 403; anonymous → 401 | T-ACC-API-20, T-TX-API-14, T-DEBT-API-04, T-HST-API-06, T-FAV-API-02, T-ADM-API-04 | Pass |
| Schema migration `add_account_archived_at` × existing data | existing accounts stay active; no data change | migration applied by every test run and E2E reset; `prisma migrate diff` empty | Pass |

## 4. Manual cross-checks (each member checks the other's features)

No separate local manual click-through pass was performed before the release PR. Pre-release UI and behaviour verification is covered by:

- **Playwright E2E (`12 / 12`):** end-to-end flows across F-06…F-10 plus the Sprint 1 continuity journey (`demo-journey.spec.ts`), BR-01 rejection, and BR-04 / BR-05 access control.
- **Client component tests (`110 / 110`):** UI details not exercised individually in E2E, including archive badges, hidden delete and type controls for `inUse` accounts, form/API error alerts, and Transfer form option labels.
- **Server unit and API/DB tests (`265 / 265`):** business rules, persistence, migrations, and route access control.
- **Peer PR reviews (#66, #73–#79):** cross-checked contracts, code, and test coverage between Harit and Jirawat.

Manual verification is combined with the **post-deploy live demo check** on the deployed Cloud Run URL after `Sprint-2/staging → main` merges: both members run two Sprint 2 workflows plus the Sprint 1 continuity journey on the live app (showing saved data/persistence, a rule rejection, and forbidden access), with captioned screenshots and results recorded in `evidence.md` §6 and the Deliverable 2 PDF. If any issue is found on the live deployment, roll back to `0731479`.

## 5. Changes made during integration

| Change | Where | Why |
|---|---|---|
| Traceability conflict between #75 and #76 resolved by merging staging into the follow-up branch (`0160a35`), keeping both sides | `docs/traceability.md` | Both PRs edited the same rows; suites rerun on the merge (server 234, client 95, E2E 10) |
| F-08 "overpaid" label for money lent corrected and the loan form's Date field error added | `fea600c` (in #78) | Found in the #75 review after #75 had merged |
| F-09 PR description and traceability corrected: E2E is a local run, CI does not run Playwright | `c46fd8d` (in #77) | Found in the #77 review |
| Status text of `srs.md`, `features.md`, `system-sds.md`, F-06/F-07/F-08 version rows and `plan.md` §6 brought up to date | S2-07 | Docs audit before release |

**Process incident (corrected):** on 22 Nov the first push of `Issue-S2-03` went straight to `Sprint-2/staging`,
because the branch had been created with `origin/Sprint-2/staging` as its upstream. No CI ran and nothing was built on
top. `Sprint-2/staging` was reset to `c09f4ad` with `--force-with-lease`, the two commits were pushed to
`Issue-S2-03`, and F-07 then went through PR #74 as normal.

## 6. Defects and known limitations

| Item | Status |
|---|---|
| AC-TX-15 (F-07) and AC-DEBT-03 (F-08): a transfer or loan payment may not overdraw a Cash account | Deferred to L7-01 (#64), awaiting TA approval; BR-14 not implemented, so overdrafts are still allowed |
| AC-FAV-04: the insufficient-funds case of a duplicate | The UI shows any server error (T-FAV-UI-02); the server rule itself arrives with L7-01 |
| E2E is not part of CI | E2E is run locally before each release; recorded in `test-results.md` |
| E2E is Chromium-only; no performance measurement | Carried over from Sprint 1 |
| Manual cross-checks (§4) | No separate local manual pass before release; covered pre-release by E2E (12/12), client component tests (110/110), server tests (265/265), and PR reviews (#66, #73–#79), and completed via the post-deploy live demo check on the deployed URL |
