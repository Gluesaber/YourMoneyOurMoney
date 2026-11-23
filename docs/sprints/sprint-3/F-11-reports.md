# F-11 — Financial Reports & Periodic Spending Summaries (Sprint 3 contract)

> **Status:** v0.2 — v0.1 reviewed in #89; revised for implementation in S3-02 (#84) before any F-11 code (§10).
> **Requirements:** FR-SUM-04 · BR-03, BR-04, BR-05, BR-08 · DL-09 (charts, team addition)
> **Depends on:** F-05 (balance rules), F-09 (date-range conventions). F-12 (voids) is not built yet: once it is, voided
> transactions are excluded here too, verified by F-12's AC-VOID-03 (v0.2).
> **IDs:** `AC-REP-01…`, `T-REP-API-01…`, `T-REP-UI-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

A **Reports** page shows, for a chosen period:

- **Monthly income vs expense**: one row/bar per calendar month with income, expense and net (income − expense).
- **Category breakdown**: total per EXPENSE (or INCOME) category, largest first, with each category's share.
- **Average per day** of the chosen type (expense by default) over the period.

Income and expense come only from INCOME / EXPENSE **lines**, by transaction date — the same accounts the
dashboard totals use, so transfers, loans, repayments and opening balances are never counted (BR-08).
Voided transactions (F-12) are excluded.

### 1.1 Worked example (Sprint 1 demo journey + one December payment)

| Month | Income | Expense | Net |
|---|---|---|---|
| 2026-11 | 30,000.00 (Salary, 11-02) | 1,500.00 (Dining 900.00 + Groceries 600.00, 11-03) | 28,500.00 |
| 2026-12 | 0.00 | 300.00 (Telecom, 12-05) | −300.00 |

The card repayment (11-04) and the opening balance (11-01) appear nowhere.

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | `from`, `to` are **required** `YYYY-MM` between 2000-01 and 2099-12, `from` ≤ `to`, at most 24 months inclusive | bounded input | 400 `VALIDATION_ERROR` |
| R2 | Breakdown `startDate`/`endDate` are **required** and follow F-09 date rules (real dates 2000–2099, inclusive, `startDate` ≤ `endDate`, ≤ 366 days); `type` ∈ EXPENSE (default), INCOME | — | 400 `VALIDATION_ERROR` |
| R3 | Only the user's own lines are aggregated | BR-04 | (`userId` filter) |
| R4 | Only INCOME / EXPENSE lines count; voided transactions excluded | BR-08, F-12 | (computed) |
| R5 | All amounts integer satang; `share` in basis points (integer, 0–10,000), largest-remainder rounding so shares sum to exactly 10,000 when total > 0; equal remainders give the extra point to the earlier category in output order (largest total first, then name) | BR-03 | (computed) |
| R6 | `averageDaily` = the breakdown `total` ÷ number of days in the range, rounded half up to the nearest satang | BR-03 | (computed) |
| R7 | Months with no data are returned with zeros (no gaps) | — | — |
| R8 | ADMIN 403, anonymous 401 | BR-05 | 403 / 401 |

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| `monthlyTotals(lines, from, to)`, `categoryBreakdown(lines, accounts)`, `shareBasisPoints(values)`, `averagePerDay(total, days)` | `server/src/services/reports.ts` (pure, unit-tested) |
| Queries (lines joined to transaction date, `userId`, not voided) | `server/src/routes/reports.routes.ts` |
| Charts | `client/src/components/BarChart.tsx`, `ShareBars.tsx` — plain SVG/CSS, no new dependency (§8) |

## 3. API

```
GET /api/reports/monthly?from=2026-11&to=2026-12
→ 200 { "months": [ { "month": "2026-11", "income": 3000000, "expense": 150000, "net": 2850000 },
                    { "month": "2026-12", "income": 0, "expense": 30000, "net": -30000 } ],
        "totals": { "income": 3000000, "expense": 180000, "net": 2820000 } }

GET /api/reports/category-breakdown?startDate=2026-11-01&endDate=2026-11-30&type=EXPENSE
→ 200 { "type": "EXPENSE", "total": 150000, "days": 30, "averageDaily": 5000,
        "categories": [ { "accountId": 7, "name": "Dining", "total": 90000, "share": 6000 },
                        { "accountId": 8, "name": "Groceries", "total": 60000, "share": 4000 } ] }

→ 400 VALIDATION_ERROR · 401 · 403
```

Categories with 0 in the range are omitted; ties sorted by name.

## 4. Data

No schema change. Uses `TransactionLine` joined to `Transaction.date` and `Account.type`; index `(userId, date)`.

## 5. UI

- **Reports page (`/reports`)**, linked from the dashboard and nav.
- Period controls: month range (default: last 12 months ending this month, computed in the browser) and the F-09
  quick buttons for the breakdown range. The period and type are kept in the URL (`?from=&to=&startDate=&endDate=&type=`),
  like the F-09 filters, so reload and back keep them.
- Monthly table + bar chart (income and expense bars per month, net column; negative net in red).
- Breakdown: Expense / Income toggle; table and horizontal share bars; percentages shown as `share / 100` with
  two decimals; average per day under the table.
- Empty period: "No income or expense in this period." Server 400 → alert, controls kept.
- Charts have text equivalents (the tables) for accessibility.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-REP-01 | Given the §1.1 data, monthly report 2026-11…2026-12 returns exactly the §1.1 values; months without data are zero rows. |
| AC-REP-02 | Transfers, loans, repayments and opening balances never change any report value (BR-08). *(Voided transactions: verified with F-12, AC-VOID-03, v0.2.)* |
| AC-REP-03 | Category breakdown for Nov 2026 returns Dining 90,000 (6,000 bp) and Groceries 60,000 (4,000 bp), `averageDaily` 5,000 satang; shares always sum to 10,000 when total > 0. |
| AC-REP-04 | Invalid or too-long ranges → 400; bob's data never included; ADMIN 403; anonymous 401. |
| AC-REP-05 | The Reports page shows the monthly table/chart and breakdown for the chosen period, with negative net in red. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-REP-UNIT-01 | Unit | `monthlyTotals` on §1.1 lines, range with an empty month in the middle | values as §1.1; zero rows filled | AC-REP-01 |
| T-REP-UNIT-02 | Unit | `shareBasisPoints([1,1,1])`, `([90000,60000])`, `([0])`, `([1])` | `[3334,3333,3333]`, `[6000,4000]`, `[0]`, `[10000]` | AC-REP-03 |
| T-REP-UNIT-03 | Unit | `averagePerDay(150000, 30)`, `(100, 3)`, `(5, 2)` | 5000, 33, 3 (half up) | AC-REP-03 |
| T-REP-API-01 | API | demo journey + Telecom 30,000 on 2026-12-05; monthly 2026-11…2026-12 | §3 body exactly | AC-REP-01 |
| T-REP-API-02 | API | after T-REP-API-01's data, add in Nov a transfer Bank → Wallet, a lend to a LOAN_GIVEN account and a Bank opening-balance change; re-run both reports | identical to before | AC-REP-02 |
| T-REP-API-03 | API | breakdown Nov 2026 EXPENSE and INCOME | §3 body; INCOME → Salary 3,000,000, 10,000 bp, `averageDaily` 100,000 | AC-REP-03 |
| T-REP-API-04 | API (table) | `from` > `to`; 25 months; `2026-13`; missing `from`; breakdown `type=CASH`; reversed / 367-day / missing dates; bob's expenses present; admin; anon | 400 each; bob excluded; 403; 401 | AC-REP-04 |
| T-REP-UI-01 | Component | `/reports?from=2026-11&to=2026-12&startDate=2026-11-01&endDate=2026-11-30` with mocked §3 bodies | table values in baht, negative net red, shares "60.00 %", average per day 50.00; empty period message when no data | AC-REP-05 |
| T-REP-E2E-01 | E2E | alice after demo journey opens Reports for Nov 2026 | income 30,000.00, expense 1,500.00, Dining 60.00 % | AC-REP-05 |

Regression kept: T-SUM-* (dashboard totals must equal the report totals over all time), access suite.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Source of income/expense | INCOME/EXPENSE lines by transaction date | Same rule as F-05 totals, so reports and dashboard agree |
| Shares | Integer basis points, largest remainder | No floating-point money or percentages on the server (BR-03); shares add to 100 % |
| Chart library | None; small SVG/CSS components | Avoids a new dependency for two simple charts |
| Default period | Computed by the client | Server stays free of "today" and time zones (same as F-04 dates) |
| Range limits | 24 months / 366 days | Bounded queries |

## 9. Definition of Done

- [ ] T-REP-UNIT-01…03, T-REP-API-01…04 pass (`npm --prefix server test`); T-REP-UI-01 passes (`npm --prefix client test`); T-REP-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-SUM-04, System SDS §5 (new routes), `traceability.md` updated
- [ ] PR into `Sprint-3/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-23 | `8db8a8d` | #89 / S3-01 (#83) | First draft for review (drafted 2026-11-22, refreshed against the Sprint 2 code 2026-11-23) |
| 0.2 | 2026-11-23 | — | S3-02 (#84), before code | R1/R2 parameters required; R5 tie rule; period kept in the URL (§5); voided case of AC-REP-02 / T-REP-API-02 moved to F-12 (not built yet); T-REP-API-04 and T-REP-UI-01 inputs made concrete |
