# F-09 — Transaction Search, Filtering & Sorting (Sprint 2 contract)

> **Status:** v0.1 draft for review. Merged before any F-09 code.
> **Requirements:** FR-HST-03 (extends FR-HST-01) · BR-04, BR-05 · NFR-SEC-03
> **Depends on:** F-05 (`GET /api/transactions`). F-10 adds `favorite=true` to the same query parser.
> **IDs:** `AC-HST-04…`, `T-HST-API-04…` as reserved in `docs/traceability.md`; UI tests from `T-HST-UI-05`
> (`T-HST-UI-01…03` exist, `T-HST-UI-04` is used by F-07).

## 1. Behaviour

On the History page the user narrows their transactions by **date range**, **account** (source or any line),
**kind** and **text** (in the note), and chooses the **sort**. Filters combine with AND. With no filter the
result is exactly the Sprint 1 list (FR-HST-01 order). Quick buttons: This month, Last month, This year.

## 2. Rules and validation

`GET /api/transactions` query parameters (all optional):

| Param | Rule | Meaning |
|---|---|---|
| `startDate`, `endDate` | real `YYYY-MM-DD` in 2000-01-01 … 2099-12-31; `startDate` ≤ `endDate` | inclusive range on `date` |
| `accountId` | positive integer ≤ 2,147,483,647, must be the user's account | transactions where it is the source **or** a line |
| `kind` | `PAYMENT` \| `RECEIVE` | |
| `q` | trimmed, 1 … 100 characters; empty after trim = no filter | case-insensitive substring of `note` |
| `sort` | `date_desc` (default) \| `date_asc` \| `amount_desc` \| `amount_asc` | ties broken by `id` in the same direction |

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | Unknown parameter values / malformed dates / `startDate` > `endDate` / `q` > 100 | — | 400 `VALIDATION_ERROR` (details = field errors) |
| R2 | Only the user's transactions are ever returned, whatever the filters | BR-04 | (filter always includes `userId`) |
| R3 | `accountId` of another user or missing → **empty list**, not 404 | BR-04, NFR-SEC-03 | 200 `{ transactions: [] }` — same as a real account with no transactions, so ids cannot be probed |
| R4 | `q` is matched literally: `%` and `_` are not wildcards | — | (escaped) |
| R5 | ADMIN 403, anonymous 401 (unchanged) | BR-05 | 403 / 401 |
| R6 | No pagination; at most 500 rows returned, newest-first slice under the chosen sort, response says `truncated: true` when cut | bounded output | — |

Unknown parameter names are ignored (forward compatibility with F-10 / F-13).

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| zod query schema + `toWhere(query, userId)` / `toOrderBy(sort)` | `server/src/lib/transactionQuery.ts` (pure, unit-tested) |
| Route | `GET /` in `server/src/routes/transactions.routes.ts` uses them |
| Filter bar, query ↔ URL search params | `client/src/components/TransactionFilterBar.tsx`, `client/src/lib/dateRanges.ts` (quick ranges, pure) |

## 3. API

```
GET /api/transactions?startDate=2026-11-01&endDate=2026-11-30&accountId=7&kind=PAYMENT&q=dinner&sort=date_desc
→ 200 { "transactions": Transaction[], "truncated": false }   // Transaction shape unchanged (system-sds §5.3)
→ 400 VALIDATION_ERROR · 401 · 403
```

`truncated` is a new field; existing clients ignore it.

## 4. Data

No schema change. Existing index `(userId, date)` serves date filters. `q` uses `ILIKE` on `note` (no index;
acceptable at ≤ thousands of rows per user — stated as a performance limitation).

## 5. UI

- **History page (`/transactions`)** gets a filter bar: From / To dates, Account select (all the user's accounts,
  archived included), Kind (All / Payment / Receive), Search box, Sort select, quick buttons, **Clear**.
- Filters are kept in the URL (`?startDate=…`), so reload/back keeps them.
- Empty result: "No transactions match these filters." with Clear. Server 400 → alert, filters kept.
- Search input is debounced; dates use the browser's local date for quick ranges.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-HST-04 | With the demo journey + extra fixtures, `startDate`/`endDate` return only transactions in the inclusive range; boundary dates included; `startDate` > `endDate` → 400. |
| AC-HST-05 | `accountId` returns transactions where the account is the source or a line; `kind` and `q` (case-insensitive, `%`/`_` literal) narrow further; combined filters AND together; no filters = Sprint 1 list unchanged. |
| AC-HST-06 | bob's or a missing `accountId` → 200 empty list; bob's transactions never appear under any filter; ADMIN 403; anonymous 401. |
| AC-HST-07 | `sort` orders by date or total amount, ties by id; invalid `sort`/`kind`/dates/`q` > 100 → 400 `VALIDATION_ERROR`. |
| AC-HST-08 | In the UI, setting filters updates the list and the URL; This month sets the correct range; Clear restores the full list. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-HST-UNIT-01 | Unit | `toWhere` / `toOrderBy` for each param and combination | Prisma where/orderBy as specified, always with `userId` | AC-HST-04, 05, 07 |
| T-HST-UNIT-02 | Unit (client) | `dateRanges` for This month / Last month / This year on 2026-01-15 and 2026-12-31 | correct first/last days incl. year change | AC-HST-08 |
| T-HST-API-04 | API | transactions dated 2026-10-31, 11-01, 11-15, 11-30, 12-01; range 11-01 … 11-30; reversed range | 3 rows (boundaries included); 400 | AC-HST-04 |
| T-HST-API-05 | API | F-04 demo #1–#3 bodies (demo #2 carries note "Dinner and groceries"; `runDemoJourney` sends no notes); `accountId`=Credit Card (source in #2, line in #3); `kind=RECEIVE`; `q=DINNER`; `q=%`; combined filter | 2 rows; 1; 1; 0; AND result | AC-HST-05 |
| T-HST-API-06 | API | alice with bob's account id / 999999; bob has notes matching `q`; admin; anon | 200 `[]` / `[]`; no bob rows; 403; 401 | AC-HST-06 |
| T-HST-API-07 | API (table) | each `sort`; `sort=foo`, `kind=X`, `startDate=2026-02-30`, `q` 101 chars | correct order; 400 each | AC-HST-07 |
| T-HST-API-08 | API | no query params | identical body to Sprint 1 `T-HST-API-01` expectation (+ `truncated: false`) | AC-HST-05 |
| T-HST-UI-05 | Component | filter bar: set Kind=Receive, type search, press This month, Clear | requests carry the params; URL updates; Clear removes them | AC-HST-08 |
| T-HST-E2E-01 | E2E | alice after demo journey filters Account = Dining | only the card purchase is listed | AC-HST-05, 08 |

Regression kept: T-HST-API-01…03, T-HST-UI-01…03, access suite (`GET /api/transactions` with params as admin/anon).

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Foreign `accountId` | Empty 200, not 404 | A filter, not a resource lookup; empty for both cases still hides existence (NFR-SEC-03) |
| Text search scope | Note only | Account names are already filterable by `accountId`; keeps `q` simple |
| Pagination | None; cap 500 + `truncated` | Sprint 1 had none; cap bounds the response; real paging is out of Sprint 2 scope |
| Sort by amount | `totalAmount` | The only amount on a transaction |

## 9. Definition of Done

- [ ] T-HST-UNIT-01, T-HST-API-04…08 pass (`npm --prefix server test`); T-HST-UNIT-02, T-HST-UI-05 pass (`npm --prefix client test`); T-HST-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-HST-03, System SDS §5.3 (query params, `truncated`), `traceability.md` rows updated
- [ ] PR into `Sprint-2/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-21 | — (draft, not committed) | — | First draft for review |
