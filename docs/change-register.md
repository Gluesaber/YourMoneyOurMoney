# YourMoneyOurMoney — Change and Defect Register

> **Document Version:** 1.0.0  
> **Date:** 2026-11-24  
> **Status:** Deliverable 2 checkpoint; covers Lab 5 (deployment), Lab 6 (UAT), Sprint 2 reviews and Lab 7 (maintenance)  
> **Accepted Sprint 1 baseline:** `v0.1.0` @ `d2be6e7`; Lab 6 accepted release `main` @ `0731479` (Cloud Run `ymom-00007-pkv`)  
> **Current release candidate:** `v0.3.0-rc.1` @ `65538ae` (Cloud Run `ymom-00010-2xp`)

Every finding that changed, or was decided not to change, the accepted product or its delivery process. **Resolved**
means the fix is merged to `main`, deployed and re-tested; **Remaining** items have an owner and a next action in
`docs/sprints/plan.md` §6. Times are Asia/Bangkok (UTC+7).

## 1. Register

| ID | Source | Affects | Finding or change | Accepted decision | Status | Fix / change release | Re-test outcome |
|---|---|---|---|---|---|---|---|
| CR-01 | Lab 5 deploy, 14 Nov | Delivery pipeline (`deploy.yml`, `ymom-migrate`) | Auto-deploy of `a09855f` failed once at the migration job (transient GCP error); `release.sh` stopped before touching the live service | No code change: the pipeline behaved as designed; re-run the same job | Resolved | Re-run of the same run, 16 Nov (`a09855f`) | Migrate, deploy and smoke PASS; `/api/health`, `/api/ready` 200 |
| CR-02 | Lab 5 process, 14 Nov | `docs/labs/lab05/deployment.md` | PR #53 accidentally reverted the deployment guide merged in #52 | Restore by a reviewed PR, not by force-push | Resolved | PR #55 → `main` @ `a09855f` | File content checked on `main` |
| CR-03 | Lab 5 review of #44 (Jirawat) | NFR-SEC (secrets), Docker build | `.dockerignore` excludes `.env` and `*.env` but not `.env.*`; `dist/test` is compiled into the image (~180 KB) | Accepted as low-risk debt (no `.env.*` file exists; size negligible) | Remaining (debt TD-4, TD-5) | One-line `.dockerignore` fix with the next deployment change | — |
| D-59 | Lab 6 UAT by CPMS, #59 | F-05, NFR-COMP-02 | A 200-character note without spaces overflowed the transaction detail page (Minor) | Defect; fix in Sprint 1 scope | Resolved | PR #62 → PR #63 → `main` @ `0731479`, `ymom-00007-pkv` | CPMS re-test PASS 20 Nov; final UAT decision **Accepted** |
| D-60 | Lab 6 UAT by CPMS, #60 | F-03, F-04, `system-sds.md` §1.4 | An out-of-range date showed a generic error and did not highlight the Date field (Minor) | Defect; fix in Sprint 1 scope | Resolved | PR #61 → PR #63 → `main` @ `0731479`, `ymom-00007-pkv` | CPMS re-test PASS 20 Nov; final UAT decision **Accepted** |
| CR-04 | Sprint 2 contract review, #74 (F-07 v0.3) | F-07 AC-TX-15, F-08 AC-DEBT-03 | The two overdraft AC need BR-14, which would change a Sprint 1 rule | Moved to the Lab 7 change request L7-01 before any F-07 / F-08 code (contract revisions, not deletions) | Resolved | Implemented by L7-01 in `v0.3.0-rc.1` | T-FUND-API-07 and T-FUND-API-08 PASS |
| CR-05 | Review of PR #73 (F-06) | F-06 FR-ACC-06, BR-15 / BR-16 UI | Accounts page offered Delete and Type change for accounts already used; row buttons stayed enabled while saving | Fix as a follow-up (contracts v0.4 first) | Resolved | PR #76 → `Sprint-2/staging` → PR #81 → `v0.2.0` (`cd90cb6`) | T-ACC-API-21, T-ACC-UI-05 PASS; S2-07 regression PASS |
| CR-06 | Review of PR #74 (F-07) | F-07, #60 pattern | Transfer form did not highlight the Date field from a server date error | Fix as a follow-up | Resolved | PR #76 → `v0.2.0` | T-TRF-UI-03 PASS |
| CR-07 | Review of PR #75 (F-08) | F-08 FR-TX-09 | Loans page labelled a negative "money you lent" as "you overpaid" (backwards); loan form lacked the #60 Date highlight | Fix with F-10 (#71) | Resolved | `fea600c` in PR #78 → `v0.2.0` | `client/test/loansPage.test.tsx` PASS |
| CR-08 | Process, 22 Nov | `Sprint-2/staging` | First push of `Issue-S2-03` went straight to `Sprint-2/staging` (branch upstream was staging) | Reset staging to `c09f4ad` with `--force-with-lease`; always `git push -u origin <branch>` | Resolved | — | Staging history checked; F-07 then merged by PR #74 |
| CR-09 | Process, 23 Nov | Deployment | PR #82 (Sprint 2 evidence, docs only) was merged into `main` instead of staging and triggered a redeploy | Accepted: same code as `v0.2.0`; recorded, later records go to staging first | Resolved | `main` @ `249eb2d`, `ymom-00009-dd6` | Deploy run 45119065635 smoke PASS |
| CR-10 | Process, 24 Nov | `Sprint-3/staging` | The Deliverable 2 records commit `917827a` was committed on the local staging branch and pushed straight to `Sprint-3/staging` (with merge `e1c4cb0` bringing in #95) instead of through a reviewed PR | Keep the commits (no history rewrite); Jirawat reviews them in the release PR to `main`; create the branch before committing | Resolved when the release PR is approved | Release PR `Sprint-3/staging → main` | Review recorded on the release PR |
| L7-01 | Lab 7 change request, #64 (TA approved 24 Nov) | F-04 FR-TX-01/02 (and F-07, F-08 save path); new BR-14 | Old rule: a Cash balance may go negative. New rule: a new transaction must not overdraw a Cash account (400 `INSUFFICIENT_FUNDS`) | Approved changed requirement; contract F-04 v1.1 reviewed (#91) before code | Resolved | PRs #91, #92 → PR #93 → `v0.3.0-rc.1` (`65538ae`), `ymom-00010-2xp` | RED 9 failed → GREEN 307 / 307; post-deploy checks 8 / 8 PASS 24 Nov 21:10–21:25 |
| TD-1 | Lab 7 Part C metrics | All journeys (NFR test coverage) | Playwright E2E (13 tests) runs only locally, not in CI | Add an E2E CI job as a required check | Remaining | Before the F-12 PR (#85) | — |
| TD-2 | Lab 7 review | BR-14 concurrency | No automated test of two concurrent payments from one Cash account | Add one parallel-request API test | Remaining | With F-12 (#85) | — |
| TD-3 | Lab 7 deploy log | Smoke test | Deploy smoke skips the login step (no smoke credentials) | Add a synthetic smoke user and its secret | Remaining | Before S3-06 (#88) | — |

No defect of any severity is open at this checkpoint (open Issues are the planned features #85–#88 and the Lab 7
record #64).

## 2. Approved baseline revisions

| Revision | Baseline changed | Approved by / where | Rationale |
|---|---|---|---|
| BR-14 no Cash overdraft (L7-01) | SRS BR-14 (new); F-04 v1.0 → v1.1 (step 7, AC-FUND-01…06, AC-TX-03 precondition); System SDS §3.3, §4.4, §5.1, §5.3 | TA Kantapat Suwannahong, 24 Nov (#64); contract review Jirawat, #91 | A personal-finance ledger should not record spending of money the user does not hold; card (LOAN_TAKEN) spending is unchanged |
| AC-TX-15, AC-DEBT-03 moved to L7-01 | F-07 v0.3, F-08 v0.3 | Contract PRs reviewed by the other member (#74, #75) | They depend on BR-14; moving them kept Sprint 2 within the accepted Sprint 1 rules until the change was approved |
| BR-15, BR-16 added with F-06 | SRS BR-15 (type fixed once used), BR-16 (archived accounts) | Sprint 2 contracts PR #66 | Needed for custom account management without corrupting history |
| F-11 voided-transaction case → F-12 | F-11 v0.1 → v0.2 (AC-REP-02) | F-11 contract v0.2 `50f146f` (#84), before code; reviewed in PR #90 | Voiding does not exist until F-12; the report rule is tested there |
| Sprint 3 owners | F-12 Harit; F-13, F-14 Jirawat | Team decision 23 Nov (#85–#87) | Balances the remaining work across tracks |
