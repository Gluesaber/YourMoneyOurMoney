# Sprint 1 — Integration and System Test Record (S1-15)

> **Date:** 2026-11-05 · **Branch:** `Issue-S1-15`, cut from `Sprint-1/staging` at `c54abff` (all Sprint 1 feature
> PRs merged) · **Environment:** Windows 11, Node.js 25.8, PostgreSQL 16 (Docker), Playwright 1.64.1 / Chromium

## 1. What is integrated

Every Sprint 1 issue PR was reviewed, approved and merged into `Sprint-1/staging` before this run. No feature PR
was open.

| Issue | PR | Track | Content |
|---|---|---|---|
| S1-01 | #17 | Together | Scaffold, test harness |
| S1-02 | #18 | Together | Shared contracts, financial schema |
| S1-03 | #20 | A | SRS, features, traceability |
| S1-04 | #23 | A | F-01 / F-02 contracts |
| S1-05 | #25 | A | Login, logout, current user API |
| S1-06 | #27 | A | Authorization, access-control suite |
| S1-07 | #29 | A | Admin user API |
| S1-08 | #30 | A | Login and admin UI, auth E2E |
| S1-09 | #19 | B | System SDS, three-sprint plan |
| S1-10 | #21 | B | F-03 / F-04 / F-05 contracts |
| S1-11 | #22 | B | Seeded accounts, opening balance API |
| S1-12 | #24 | B | Record transaction API |
| S1-13 | #26 | B | Summary, history API |
| S1-14 | #28 | B | Dashboard, forms, history UI |

## 2. Automated results on the integrated code

| Suite | Command | Result |
|---|---|---|
| Server unit + API/DB (Vitest + Supertest) | `npm --prefix server test` | **183 / 183 passed** (16 files) |
| Client component (Vitest + RTL) | `npm --prefix client test` | **69 / 69 passed** (9 files) |
| End-to-end (Playwright, Chromium) | `npm run test:e2e` | **7 / 7 passed**, repeated on 5 consecutive runs (17.6 – 22.1 s) |
| Lint | `npm run lint` | no problems |
| Format | `npm run format:check` | all files formatted |
| Types | `npm --prefix server run typecheck`, `npm --prefix client run typecheck` | no errors |

End-to-end tests (`e2e/`):

| Test | Covers | Result |
|---|---|---|
| T-AUTH-E2E-01 | Invalid password alert; alice logs in to `/dashboard` | Pass |
| T-AUTH-E2E-02 | Log out returns to `/login` and blocks `/dashboard` | Pass |
| T-ADM-E2E-01 | Admin user list; own Disable button disabled; admin redirected from `/dashboard` | Pass |
| T-ADM-E2E-02 | Admin disables alice → her login is refused → re-enabled → she logs in | Pass |
| T-ACC-E2E-01 / T-TX-E2E-01 / T-SUM-E2E-01 | **The Sprint 1 demo journey through the UI**: opening balance 10,000.00 → salary 30,000.00 → card purchase Dining 900.00 + Groceries 600.00 → card repayment 1,500.00. Dashboard shows **Bank 38,500.00, card 0.00, income 30,000.00, expense 1,500.00**; History lists the three newest first | Pass |
| Rejected case (BR-01) | Save stays disabled with 600.00 unallocated; the same request sent to the API returns 400 `ALLOCATION_MISMATCH` and nothing is stored | Pass |
| Access case (BR-04, BR-05) | alice opening bob's transaction sees "Transaction not found" and the API returns 404; bob's note never appears in her History; admin is redirected from `/dashboard` and gets 403 from `/api/summary` | Pass |

## 3. Manual cross-checks (each member runs the other's track)

### 3.1 Track A screens, checked by Gluesaber (Track B) — 2026-11-05, dev servers, dev database

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | Opening the app with a session from the previous day | Lands on `/login` (session no longer valid) | Pass |
| 2 | Log in as alice with a wrong password | "Invalid username or password." | Pass |
| 3 | Log in as admin | Lands on `/admin/users`; admin, alice, bob listed with role and status | Pass |
| 4 | admin's own row | Disable button is disabled (BR-07) | Pass |
| 5 | Disable bob, log out, log in as bob | bob shown "Disabled"; bob's login refused with "This account has been disabled." | Pass |
| 6 | Log in as admin, re-enable bob | bob shown "Enabled" | Pass |
| 7 | As admin, open `/dashboard`; call `/api/summary` | Redirected to `/admin/users`; 403 | Pass |
| 8 | As alice, call `/api/admin/users`; open `/admin/users` | 403 `FORBIDDEN`; redirected to `/dashboard` with "alice" in the navbar | Pass |

Steps 7 and 8 were checked through the page's own requests because the browser pane stopped drawing; the
results are the same responses the screens use. All seeded users were left enabled afterwards.

Track B screens were also exercised end to end by Gluesaber during S1-14 at phone width (364 px): the full demo
journey, the not-found page, and no sideways scrolling on any page after the layout fix in PR #28.

### 3.2 Track B screens, checked by ArgoJR203 (Track A)

To be run and recorded by ArgoJR203 on `Sprint-1/staging` after this PR merges: log in as alice, set Bank's
opening balance, record a Receive and a split Payment, confirm the dashboard totals and History, and confirm an
allocation mismatch cannot be saved.

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | Set Bank opening balance 10,000.00 | Dashboard Bank 10,000.00; income still 0.00 | |
| 2 | Record money received: Bank ← Salary 30,000.00 | Detail page "Money received"; Bank 40,000.00 | |
| 3 | Record payment: Credit Card → Dining 900.00 + Groceries 600.00 | Remaining 0.00 enables Save; card owes 1,500.00 | |
| 4 | Record payment: Bank → Credit Card 1,500.00 | Bank 38,500.00; card 0.00; expense 1,500.00 | |
| 5 | Payment with total 1,500.00 and one line 900.00 | Save disabled; "Remaining to allocate" 600.00 | |

## 4. Changes made during integration (S1-15)

| Change | Why |
|---|---|
| E2E runs against its own database (`ymom_e2e`), reset and seeded before every run (`e2e/globalSetup.ts`, `server/test/helpers/reset-db.cli.ts`), on its own ports 3100 / 5174 (`playwright.config.ts`, `client/vite.config.ts` `API_PROXY_TARGET`) | The S1-08 E2E specs ran against the dev database and reused any running dev servers, so results depended on whatever was in dev data (a demo-journey test needs a known starting state) |
| `workers: 1` in `playwright.config.ts` | Spec files share one database; T-ADM-E2E-02 disables alice while another file could log in as her |
| New `e2e/demo-journey.spec.ts` and `e2e/helpers.ts` | T-ACC-E2E-01, T-TX-E2E-01, T-SUM-E2E-01, the rejected case and the access case required by S1-15 |
| `docs/traceability.md` v1.3.0 | Every Sprint 1 row now names real, passing tests; AC ranges match the F-0x contracts; future-sprint IDs renumbered where they clashed with Sprint 1 IDs; test index added |
| `docs/sprints/plan.md` §3 | Feature list reconciled with `docs/features.md`; each difference logged in §6 |
| README §6 | Documents the separate E2E database and ports |

## 5. Defects and known limitations

No defect was found in the integrated Sprint 1 behaviour.

| Item | Status |
|---|---|
| E2E tests depended on dev data and dev servers | Fixed in S1-15 (§4) |
| Playwright needs its browser build installed once per machine (`npx playwright install chromium`) | Documented in README §6 |
| Browser coverage: E2E runs on Chromium only (NFR-COMP-01 also lists Firefox and Edge) | Open — planned with the Lab 5 CI setup |
| Responsive layout checked manually at 364 px (NFR-COMP-02), not automated | Open — Sprint 3 hardening |
| Performance targets (NFR-PERF-01, NFR-PERF-02) not measured | Open — planned |
| Persistence across restart / redeploy (NFR-REL-01) on the deployed system | Lab 5 |
| The server and E2E suites need the Docker database; with it stopped they fail at setup ("no tests") | Expected; README §4 |
