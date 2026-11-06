# Sprint 1 — Deliverable 1 Evidence (Part F) and Index

> Source for Part F of the Deliverable 1 PDF and an index of where Parts A–E live in the repository.
> **Release:** `v0.1.0` on `main` · **Code tested:** `516399e` (see `test-results.md`) · Times are Asia/Bangkok
> (UTC+7).

## 1. Index of Parts A–F

| Part | Points | Repository source | Key IDs |
|---|---|---|---|
| A. SRS and product scope | 10 | `docs/srs.md` | Actors, FR-AUTH/ADM/ACC/TX/SUM/HST, BR-01…BR-13, NFR-SEC/PERF/REL/COMP |
| B. Feature inventory and traceability | 10 | `docs/features.md`, `docs/traceability.md` | F-01…F-14; requirement → feature → sprint → AC → test → result |
| C. System-level SDS | 15 | `docs/system-sds.md` | §1 architecture/UI, §2 roles, §3 data, §4 balance rules, §5 API, §8 config/deploy |
| D. Three-sprint plan | 5 | `docs/sprints/plan.md` | Sprint goals, F-01…F-14 allocation, dependencies, §5.1 Product DoD, §6 change log |
| E. Sprint 1 contracts | 20 | `docs/sprints/sprint-1/F-01-auth.md` … `F-05-summary-history.md`, `docs/sprints/plan.md` §5.1 | AC-AUTH, AC-ADM, AC-ACC, AC-TX, AC-SUM, AC-HST; T-… test IDs; DoD; version history |
| F. Working Sprint 1 and verification | 20 | This file, `test-results.md`, `integration.md`, `screenshots/`, README | Below |

## 2. Setup summary

Full instructions: README §1–§6. Prerequisites: Node.js 22+ and Docker.

```bash
npm install && npm --prefix server install && npm --prefix client install
cp server/.env.example server/.env          # then set SESSION_SECRET
docker compose up -d                         # PostgreSQL 16 on localhost:5434
cd server && npx prisma migrate dev && npx prisma db seed && cd ..
npm --prefix server run dev                  # API on :3000
npm --prefix client run dev                  # UI on http://localhost:5173
```

The seed creates synthetic users `alice`, `bob` (User) and `admin` (Administrator) with eight accounts each. Their
shared dev-only password is `DEMO_PASSWORD` in `server/prisma/seedData.ts`; it is not printed here.

## 3. Program demonstrations

Captured 2026-11-06 from the code at `516399e`, against the isolated E2E database (`ymom_e2e`, freshly reset
and seeded), 1280 px wide. Files are in `docs/sprints/sprint-1/screenshots/`. Panels titled with an HTTP method
show a real API response (status and JSON body) received by the logged-in browser session.

### 3.1 Normal domain journey and persisted retrieval

**IDs:** AC-AUTH-01, AC-ACC-11, AC-TX-12, AC-SUM-07, AC-HST-01, AC-HST-02 · **Role:** User (`alice`) ·
**Start:** freshly seeded; every amount 0.

| Step | Screenshot | Expected | Actual |
|---|---|---|---|
| Log in with a wrong password | `01-login-invalid-password` | "Invalid username or password." | As expected |
| Log in as alice | `02-dashboard-new-user` | Dashboard, all amounts 0.00, opening-balance hint | As expected |
| Set Bank opening balance 10,000.00 on 2026-11-01 | `03-opening-balance-form` | Saved; Bank 10,000.00; income still 0.00 (BR-08) | As expected |
| Record money received: Bank ← Salary 30,000.00 | — | Saved | As expected |
| Record payment from Credit Card, Dining 900 + Groceries 600, total 1,500.00 | `04-split-payment-form` | Remaining 0.00 enables Save | As expected |
| Save | `05-payment-detail-after-save` | Detail page shows both lines and the note | As expected |
| Record payment: Bank → Credit Card 1,500.00 | `06-dashboard-after-journey` | Bank 38,500.00; Credit Card 0.00; income 30,000.00; expense 1,500.00 | As expected |
| Log out, then open `/dashboard` | `07-after-logout` | Login page; dashboard blocked | As expected |
| Log in again, open History | `08-history-after-login-again` | Three transactions from the database, newest first | As expected |
| Open the saved card payment | `09-payment-detail-retrieved` | Same lines and note as when saved | As expected |

### 3.2 Business-rule rejection (BR-01)

**IDs:** AC-TX-04, AC-TX-12 · **Role:** User (`alice`) · **Start:** after §3.1.

| Step | Screenshot | Expected | Actual |
|---|---|---|---|
| Payment total 1,500.00 with one Dining line of 900.00 | `10-rejection-ui-save-disabled` | "Remaining to allocate" 600.00; Save disabled | As expected |
| Send the same payment straight to `POST /api/transactions` | `11-rejection-api-400` | 400 `ALLOCATION_MISMATCH`, difference −60,000 satang; still 3 transactions stored | As expected |

### 3.3 Login/logout and forbidden operations

**IDs:** AC-AUTH-04, AC-ADM-05, AC-HST-02, AC-HST-03, AC-ACC-09 · **Roles:** User (`alice`, `bob`), Administrator
(`admin`).

| Scenario | Screenshot | Expected | Actual |
|---|---|---|---|
| Logout (session destroyed) | `07-after-logout` | `/login`; protected page blocked | As expected |
| bob records a private transaction; alice opens its URL | `12-ownership-ui-not-found` | "Transaction not found" (BR-04) | As expected |
| alice calls `GET /api/transactions/:bobId` | `13-ownership-api-404` | 404 `NOT_FOUND`, no data (same as a missing id) | As expected |
| alice (User) calls `GET /api/admin/users` | `14-role-user-admin-api-403` | 403 `FORBIDDEN` | As expected |
| admin logs in | `15-admin-users` | User list with roles and status; no financial data | As expected |
| admin calls `GET /api/summary` | `16-role-admin-summary-api-403` | 403 `FORBIDDEN` (BR-05) | As expected |

Backend enforcement is also covered by automated API tests (§5.2, and `access.api.test.ts` in
`test-results.md` §2.1); the UI hiding a link is never the only check.

## 4. Build and test results

Commands, counts and output: `test-results.md`. **259 automated tests passed, 0 failed, 0 skipped** (server 183,
client 69, E2E 7); lint, format, type checks and the client build are clean.

The AC → planned test ID → actual test file/name → result table is `docs/traceability.md` §6. Manual checks are
separate: `integration.md` §3.

## 5. Test excerpts and TDD history

### 5.1 Domain rule: BR-01 allocation must equal the total (T-TX-API-04, AC-TX-04)

`server/test/api/transactions.api.test.ts`:

```ts
// Sends the request as alice and checks that nothing was stored.
async function expectRejected(body: unknown, status: number, code: string) {
  const before = await counts();
  const res = await (await agentAs("alice")).post("/api/transactions").send(body as object);
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(await counts()).toEqual(before);
  return res;
}

it("T-TX-API-04: lines that do not add up to the total → ALLOCATION_MISMATCH with the difference", async () => {
  const res = await expectRejected({ ...demo2(), totalAmount: 150_001 }, 400, "ALLOCATION_MISMATCH");
  expect(res.body.error.details).toEqual({ totalAmount: 150_001, linesTotal: 150_000, difference: -1 });
});
```

**TDD (S1-12, PR #24).** Tests were written against the F-04 contract (`989daea`, 2026-11-04 21:11) before the
route existed. Recorded in PR #24:

```text
Before implementation:   transactions.api.test.ts (23 tests | 22 failed)
                         validateTransaction.unit.test.ts (23 tests | 23 failed)
                         Tests  45 failed | 79 passed (124)
After implementation (30befe0, 2026-11-04 22:45):
                         Tests  124 passed (124)
```

### 5.2 Role restriction: an administrator cannot reach financial data (T-ADM-API-04 (c), AC-ADM-05, BR-05)

`server/test/api/access.api.test.ts`:

```ts
it("rejects ADMIN on all 6 financial endpoints with 403 FORBIDDEN", async () => {
  const aliceBank = await accountOf("alice", "Bank");
  const aliceDining = await accountOf("alice", "Dining");
  const adminAgent = await agentAs("admin");

  const checks = [
    await adminAgent.get("/api/accounts"),
    await adminAgent.put(`/api/accounts/${aliceBank.id}/opening-balance`)
      .send({ openingBalance: 100_000, openingDate: "2026-11-01" }),
    await adminAgent.post("/api/transactions").send({ kind: "PAYMENT", sourceAccountId: aliceBank.id,
      date: "2026-11-03", totalAmount: 10_000, lines: [{ accountId: aliceDining.id, amount: 10_000 }] }),
    await adminAgent.get("/api/transactions"),
    await adminAgent.get("/api/transactions/1"),
    await adminAgent.get("/api/summary"),
  ];
  for (const res of checks) {
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  }
});
```

**Test history.** Written in S1-06 (`7a650e1`, 2026-11-05 00:04) from the role matrix in the S1-02 shared
contracts. Case (c) passed when first run, because the financial routes and `requireRole` were already on staging.
The neighbouring cases (a, b) for the admin routes were committed as `it.fails` because `/api/admin/*` did not
exist yet; S1-07 (`152916b`, 00:26) mounted the routes and removed `.fails`, so the suite would fail if they ever
stopped being enforced. The recorded failing-then-passing run for an access rule is §5.4.

### 5.3 Execution of the two excerpts (code `516399e`)

```text
$ npx vitest run test/api/transactions.api.test.ts test/api/access.api.test.ts -t "T-TX-API-04|T-ADM-API-04 \(c\)"
 ✓ access.api.test.ts > T-ADM-API-04 (c) … > rejects ADMIN on all 6 financial endpoints with 403 FORBIDDEN
 ✓ transactions.api.test.ts > … > T-TX-API-04: lines that do not add up to the total → ALLOCATION_MISMATCH …
 Test Files  2 passed (2)
      Tests  2 passed | 29 skipped (31)      (29 = other tests in the two files, filtered out by -t)
```

### 5.4 A defect found in review, fixed test-first (PR #31)

The reviewer found that a disabled user's session was rejected but not destroyed, so re-enabling the user revived
the old cookie. The assertion was added first:

```text
Before fix (tests added on a052190):
                       T-AUTH-API-04  ✗ expected 1 to be +0   (session row still stored)
                       T-AUTH-UNIT-01 (c), (d)  ✗ expected false to be true   (session not destroyed)
                       T-AUTH-API-02  ✗ clearing cookie lacks HttpOnly
                       Tests  4 failed | 25 passed (29)
After fix (89bfa00):   Tests  29 passed (29)
```

## 6. Engineering workflow and history

### 6.1 Two sampled Issues and PRs

| | Issue S1-12 · Record a transaction | Issue S1-15 · Integration and demo-journey E2E |
|---|---|---|
| Feature / contract | F-04 (`F-04-transactions.md`), BR-01…BR-13 | F-01…F-05; integration record `integration.md` |
| Branch | `Issue-S1-12` from `Sprint-1/staging` | `Issue-S1-15` from `Sprint-1/staging` |
| PR | #24 into `Sprint-1/staging` | #31 into `Sprint-1/staging` |
| Author / reviewer | Harit Chaiyanukit / Jirawat Rachatapramet | Harit Chaiyanukit / Jirawat Rachatapramet |
| Substantive review | Changes requested 2026-11-04 23:07: `note` trimmed after the 200-character check; opening-balance dates lacked the 2000–2099 range. Fixed in `ebd8077`, re-reviewed with a new test, approved 23:27 | Changes requested 2026-11-06 02:12: disabled user's session not destroyed; logout `clearCookie` without matching attributes; E2E database creation and per-file reset. Fixed test-first in `89bfa00`, approved 12:04 |
| Merged into staging | `955dc9e`, 2026-11-04 23:28 | `516399e`, 2026-11-06 12:04 |
| Released to `main` | Release PR `Sprint-1/staging` → `main`, tag `v0.1.0` | Same |

### 6.2 Contract before code (sampled F-04 / F-01)

| When | Commit | What |
|---|---|---|
| 2026-11-04 21:11 | `989daea` | F-03, F-04, F-05 contracts with AC and test specification (S1-10) |
| 2026-11-04 21:48 | `c619e6a` | Contract PR #21 merged into staging |
| 2026-11-04 22:45 | `30befe0` | F-04 implementation and tests (S1-12); tests seen failing first (§5.1) |
| 2026-11-04 23:19 | `ebd8077` | Review fix; F-03 contract revised to 1.1 in the same PR |
| 2026-11-04 23:28 | `955dc9e` | PR #24 merged into staging |
| 2026-11-04 22:25 | `55d86e0` | F-01, F-02 contracts (S1-04) |
| 2026-11-04 22:58 | `6d30aa4` | Contract PR #23 merged into staging |
| 2026-11-04 23:21 | `2a150ac` | F-01 implementation (S1-05) |

### 6.3 All Sprint 1 PRs

Every PR went from an `Issue-S1-xx` branch into `Sprint-1/staging` and was approved by the other member; no
author approved their own PR.

| PR | Issue | Author | Reviewer | Review | Merged |
|---|---|---|---|---|---|
| #17 | S1-01 | Harit Chaiyanukit (pair) | Jirawat Rachatapramet | Changes requested → approved | 2026-11-03 22:55 |
| #18 | S1-02 | Harit Chaiyanukit (pair) | Jirawat Rachatapramet | Approved | 2026-11-03 23:43 |
| #19 | S1-09 | Harit Chaiyanukit | Jirawat Rachatapramet | Approved | 2026-11-04 20:51 |
| #20 | S1-03 | Jirawat Rachatapramet | Harit Chaiyanukit | Changes requested ×2 → approved | 2026-11-04 21:54 |
| #21 | S1-10 | Harit Chaiyanukit | Jirawat Rachatapramet | Approved | 2026-11-04 21:48 |
| #22 | S1-11 | Harit Chaiyanukit | Jirawat Rachatapramet | Approved | 2026-11-04 22:31 |
| #23 | S1-04 | Jirawat Rachatapramet | Harit Chaiyanukit | Changes requested → approved | 2026-11-04 22:58 |
| #24 | S1-12 | Harit Chaiyanukit | Jirawat Rachatapramet | Changes requested → approved | 2026-11-04 23:28 |
| #25 | S1-05 | Jirawat Rachatapramet | Harit Chaiyanukit | Changes requested → approved | 2026-11-04 23:48 |
| #26 | S1-13 | Harit Chaiyanukit | Jirawat Rachatapramet | Approved | 2026-11-04 23:46 |
| #27 | S1-06 | Jirawat Rachatapramet | Harit Chaiyanukit | Approved | 2026-11-05 00:12 |
| #28 | S1-14 | Harit Chaiyanukit | Jirawat Rachatapramet | Approved | 2026-11-05 00:15 |
| #29 | S1-07 | Jirawat Rachatapramet | Harit Chaiyanukit | Approved | 2026-11-05 00:31 |
| #30 | S1-08 | Jirawat Rachatapramet | Harit Chaiyanukit | Approved | 2026-11-05 01:18 |
| #31 | S1-15 (pair) | Harit Chaiyanukit | Jirawat Rachatapramet | Changes requested → approved | 2026-11-06 12:04 |

## 7. Contribution

| Member | Track | Issues led | Reviewed |
|---|---|---|---|
| Harit Chaiyanukit | B: accounts, transactions, summary, history, dashboard UI | S1-09 SDS and plan, S1-10 F-03/F-04/F-05 contracts, S1-11, S1-12, S1-13, S1-14; S1-15 integration (pair) | PRs #20, #23, #25, #27, #29, #30 |
| Jirawat Rachatapramet | A: authentication, authorization, admin | S1-03 SRS/features/traceability, S1-04 F-01/F-02 contracts, S1-05, S1-06, S1-07, S1-08 | PRs #17–#19, #21, #22, #24, #26, #28, #31 |
| Both (pair) | | S1-01 scaffold, S1-02 shared contracts, S1-15 integration, S1-16 release | — |

Non-merge commits on `Sprint-1/staging`: 13 each. Each member also ran the other track's screens by hand
(`integration.md` §3).

## 8. AI-use declaration

| Member | Tool | Tasks assisted | How the output was checked |
|---|---|---|---|
| Harit Chaiyanukit | Claude Code (Claude Opus 5.5) | Drafting the Issues, system SDS, three-sprint plan and F-03…F-05 contracts (S1-09, S1-10); writing tests first, then the implementation, for S1-11…S1-15; discussing reviews of the teammate's PRs; drafting PR descriptions; capturing the Part F screenshots | Read every change before committing; saw new tests fail before the implementation; ran the server, client and E2E suites, lint, format and type checks before each PR; the teammate reviewed every PR; decisions (overdraft, date range, limits) were made by the member, not the tool |
| Jirawat Rachatapramet | Antigravity (Gemini 4 Argon) | Drafting the SRS, feature inventory and traceability matrix (S1-03) and the F-01 / F-02 contracts (S1-04); implementing the login, logout and current-user routes (S1-05), the `requireUser` / `requireRole` middleware (S1-06) and the admin user API with the self-disable guard (S1-07), with their unit and API tests | Cross-checked requirements against the Theme 7 brief and the SDS role matrix; confirmed every cited test ID matched a real test; inspected the security rules (session fixation, 24-hour expiry, dummy bcrypt hash, BR-07); saw the access tests fail before the middleware existed; ran the server tests, type check, lint and format check before each PR; the teammate reviewed every PR |

## 9. Known limitations and incomplete work

- **Failed or skipped tests:** none (`test-results.md`).
- **Browsers:** E2E runs on Chromium only; Firefox and Edge (NFR-COMP-01) are planned with the Lab 5 CI setup.
- **Responsive layout:** checked by hand at 364 px (NFR-COMP-02), not automated; Sprint 3 hardening.
- **Performance:** NFR-PERF-01 and NFR-PERF-02 not yet measured.
- **Deployment:** Docker packaging of the app, CI/CD and GCP are Lab 5; persistence across redeploy (NFR-REL-01)
  is verified there.
- **Scope:** Sprint 1 uses seeded accounts only; F-06…F-14 are planned for Sprints 2 and 3 (`plan.md` §3).
