# Sprint 3 Release Candidate — Integration, Test and Deployment Record (Deliverable 2)

> **Candidate:** tag `v0.3.0-rc.1` → `main` @ `65538ae` (release PR #93, merged 2026-11-24 21:03), deployed as Cloud
> Run revision `ymom-00010-2xp`. Times are Asia/Bangkok (UTC+7).
> **Contents:** Sprint 1 (accepted `v0.1.0`, Lab 6 fixes `0731479`), Sprint 2 F-06…F-10 (accepted `v0.2.0` @ `cd90cb6`),
> Sprint 3 F-11 reports (#84) and the Lab 7 change L7-01 / BR-14 (#64). F-12…F-14 are specified, not implemented.

## 1. Versions

| Role | Ref | Commit | Deployed |
|---|---|---|---|
| Accepted Sprint 1 baseline | `v0.1.0`; Lab 6 accepted release | `d2be6e7`; `0731479` | `ymom-00007-pkv` |
| Accepted Sprint 2 release | `v0.2.0` (PR #81) | `cd90cb6` | `ymom-00008-5rn`; docs-only redeploy `ymom-00009-dd6` (`249eb2d`) |
| Release candidate | `v0.3.0-rc.1` (PR #93) | `65538ae` | `ymom-00010-2xp` (Deploy demo run 45409970976) |

`main` after the candidate receives only reviewed docs records through `Sprint-3/staging`; the application code of the
candidate is `65538ae`.

## 2. Automated results on the candidate code

Run 2026-11-24 22:20 on `Sprint-3/staging` @ `4656a6c`, whose `server`, `client` and `e2e` trees equal `65538ae`
(`git diff 65538ae HEAD -- server client e2e` is empty). Windows 11 Pro, Node.js 25.8.0, PostgreSQL 16 (Docker,
`localhost:5434`), Playwright Chromium.

| Suite | Command | Result |
|---|---|---|
| Server unit + API/DB (Vitest, Supertest, Postgres) | `npm --prefix server test` | 27 files, **307 passed**, 0 failed, 0 skipped |
| Client components (Vitest, Testing Library) | `npm --prefix client test` | 19 files, **114 passed**, 0 failed, 0 skipped |
| End-to-end (Playwright, Chromium, 1 worker) | `npm run test:e2e` | **13 passed**, 0 failed, 0 skipped |
| Lint / format / typecheck / build | `npm run lint`, `npm run format:check`, `npm --prefix server run typecheck`, `npm --prefix client run typecheck`, `npm --prefix client run build` | all exit 0 |

CI on the same code: PR #93 run 45408900724 and Deploy demo run 45409970976 (`test-and-docker`: server 307 / 307,
client 114 / 114, Docker build) — both success. E2E is **not** part of CI (debt TD-1, `docs/change-register.md`).

## 3. Cross-feature checks

Where Sprint 3 work or the Lab 7 change touches older behaviour, shared data, roles or calculations:

| Interaction | What must hold | Covered by | Result |
|---|---|---|---|
| Sprint 1 demo journey × BR-14 | the documented journey (salary, card purchase, repayment from Bank) still gives 38,500.00 / 0 / 30,000.00 / 1,500.00 | `e2e/demo-journey.spec.ts`, T-SUM-API-02, T-TX-API-03 (funds Bank first) | Pass |
| BR-14 × F-07 transfers | a transfer cannot overdraw its From account; exact balance allowed | T-FUND-API-07 | Pass |
| BR-14 × F-08 lending | lending more than the Cash balance → 400 `INSUFFICIENT_FUNDS` | T-FUND-API-08 | Pass |
| BR-14 × card payments and receives | LOAN_TAKEN sources have no limit; a negative Cash account still receives | T-FUND-API-04 | Pass |
| BR-14 × F-04 / F-06 rule order | allocation, type and archived errors come before `INSUFFICIENT_FUNDS` | T-FUND-API-05 | Pass |
| BR-14 × user isolation and roles | another user's account → 404 without revealing a balance; ADMIN 403; anonymous 401 | T-FUND-API-06 | Pass |
| F-11 reports × F-07 / F-08 / opening balances (BR-08) | a transfer, a lend and an opening-balance change in the period change no report value | T-REP-API-02 | Pass |
| F-11 reports × user isolation and roles | bob's data never appears in alice's reports; ADMIN 403; anonymous 401 | T-REP-API-04 | Pass |
| F-11 reports × F-05 summary | report totals for the demo data equal the documented Sprint 1 summary values (income 30,000.00, expense 1,500.00) | T-REP-API-01, T-REP-E2E-01 | Pass |
| Earlier Sprint 2 journeys × BR-14 | transfer, loan and favorite journeys still save (each funds Bank first) | `transfers.spec.ts`, `loans.spec.ts`, `favorites.spec.ts` | Pass |
| Authentication and administration | login, logout, disabled user, admin kept away from financial pages | `auth-admin.spec.ts`, `access.api.test.ts`, `admin.api.test.ts` | Pass |

## 4. Deployment and post-deployment checks

Deploy demo run **45409970976** (push to `main` @ `65538ae`, 21:04–21:09): tests and Docker build → image tagged with
the commit SHA → migration job `ymom-migrate` (execution `ymom-migrate-b6xcr`; no new migration) → revision
`ymom-00010-2xp` at 100% traffic → smoke test PASS (`/api/health`, `/api/ready`, `/`; login step skipped — debt TD-3).

Post-deployment checks on `https://ymom-ck76twbqbq-as.a.run.app`, 24 Nov 21:10–21:25 (manual, Harit Chaiyanukit, demo
users), all passed — full table in `docs/labs/lab07/change-impact.md` §7:

- **Critical journey and persistence:** bob paid exactly his Bank balance (saved); the Dashboard read back from the
  database shows Bank 0.00 and expense 1,000.00; the refused 0.01 payment left no History row and no balance change.
- **Rule rejection:** 0.01 from Bank at 0.00 → "This would overdraw Bank.", values kept.
- **Preserved behaviour:** card payment and money received still save; another user's accounts → 404; ADMIN → 403;
  Reports page shows the November totals and charts.

## 5. Readiness review

| Area | State |
|---|---|
| Sprint 1 scope | READY — accepted behaviour passes on the candidate (demo journey E2E, Lab 7 post-deploy checks) |
| Sprint 2 scope | Complete — F-06…F-10 accepted in `v0.2.0`; AC-TX-15 and AC-DEBT-03 delivered by L7-01 |
| Sprint 3 scope | F-11 implemented and tested; F-12, F-13, F-14 specified (contracts v0.2) and planned before 1 Dec |
| Defects | none open (`docs/change-register.md`) |
| Debt | TD-1 E2E not in CI, TD-2 no concurrency test, TD-3 smoke login skipped, TD-4 `.dockerignore` — owners and dates in `docs/sprints/plan.md` §6 |
| Docker, environment, migrations | unchanged since `v0.2.0` (3 migrations; no new variable); `docs/labs/lab05/deployment.md` current |

## 6. Setup summary

Full instructions: `README.md` (local) and `docs/labs/lab05/deployment.md` (pipeline, rollback).

| Step | Command / value |
|---|---|
| Dependencies | Node.js 22+, Docker; `npm install`, `npm --prefix server install`, `npm --prefix client install` |
| Environment | `cp server/.env.example server/.env`; names `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`, `TEST_DATABASE_URL`; production adds `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_DATA`, `TZ` from Secret Manager / Cloud Run (no real value in Git) |
| Database | `docker compose up -d` (PostgreSQL 16 on `localhost:5434`: `ymom`, `ymom_test`) |
| Migrate and seed | `cd server`, `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (job), `npx prisma db seed` — demo users `alice`, `bob`, `admin`; the dev-only password is in `server/prisma/seedData.ts`, production passwords only in Secret Manager |
| Run | `npm --prefix server run dev` and `npm --prefix client run dev` → http://localhost:5173; or the production image: `docker compose --profile app up --build -d` |
| Test | `npm test`, `npm run test:e2e`, `npm run lint`, `npm run format:check`, both typechecks, `npm --prefix client run build` |
| Deploy | reviewed PR `Sprint-3/staging → main` → Deploy demo workflow (test, build, push, `ymom-migrate`, deploy, smoke); rollback = Run workflow with `image_tag` = a full commit SHA |

## 7. Known limitations

- E2E runs locally only (Chromium); the deploy smoke test does not log in.
- Balances that were negative before L7-01 are kept, not repaired.
- Transaction edit / void, export and password change are not in the candidate (F-12…F-14).
