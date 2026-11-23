# F-13 — Data Export: CSV & JSON (Sprint 3 contract) [Added by Team]

> **Status:** v0.1 draft for review (contract Issue S3-01 #83; implementation Issue S3-04 (#86)). Merged before any F-13 code.
> **Requirements:** FR-HST-04 · BR-03, BR-04, BR-05 · NFR-SEC-01, NFR-SEC-03 · DL-09
> **Depends on:** F-05, F-09 (filter params), F-12 (voided flag).
> **IDs:** `AC-EXP-01…`, `T-EXP-API-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

The user downloads their own data:

- **Transactions CSV** — one row per allocation line of the transactions matching the current F-09 filters, for
  spreadsheets.
- **Full backup JSON** — all their accounts (with balances), transactions and lines, for keeping a copy.

Exports are read-only and contain nothing from any other user and no credentials.

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | CSV accepts exactly the `GET /api/transactions` query params (`transactionQuery.ts`: F-09 filters, F-10 `favorite`, F-12 `includeVoided` once F-12 lands) with the same validation | F-09 | 400 `VALIDATION_ERROR` |
| R2 | Only the user's rows; another user's `accountId` → empty export (header only) | BR-04, NFR-SEC-03 | 200 |
| R3 | CSV is RFC 4180: comma separator, CRLF line ends, fields with `,` `"` CR or LF quoted, `"` doubled; UTF-8 with BOM so Excel shows Thai text | — | — |
| R4 | Formula-injection guard: a text cell (note, account name) starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` | NFR-SEC (OWASP CSV injection) | — |
| R5 | Money in two columns: `amount_thb` (`1500.50`, dot decimal, no thousands separator) and `amount_satang` (integer) | BR-03 | — |
| R6 | JSON contains no `userId`, password hash, session or other users' ids; account/transaction ids are the user's own | NFR-SEC-01 | — |
| R7 | At most 10,000 transactions per export | bounded output | 400 `VALIDATION_ERROR` "Narrow the date range." |
| R8 | ADMIN 403, anonymous 401 | BR-05 | 403 / 401 |

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| `toCsv(rows)`, `csvField(value)` (quoting + R4 guard), `satangToThbString(n)` | `server/src/services/export.ts` (pure, unit-tested) |
| Routes | `server/src/routes/export.routes.ts` (reuses F-09 `transactionQuery.ts`, `loadLedger`) |
| Buttons | History page **Export CSV** (current filters), Profile/Settings **Download backup** |

## 3. API

```
GET /api/export/transactions.csv?<F-09 params>
→ 200 text/csv; charset=utf-8
  Content-Disposition: attachment; filename="ymom-transactions-2026-11-01_2026-11-30.csv"
  (no date filter → "ymom-transactions-all.csv")

transaction_id,date,kind,source_account,line_account,line_account_type,amount_thb,amount_satang,transaction_total_thb,note,favorite,voided
12,2026-11-03,PAYMENT,Credit Card,Dining,EXPENSE,900.00,90000,1500.00,Dinner and groceries,false,false
12,2026-11-03,PAYMENT,Credit Card,Groceries,EXPENSE,600.00,60000,1500.00,Dinner and groceries,false,false

GET /api/export/backup.json
→ 200 application/json, Content-Disposition: attachment; filename="ymom-backup.json"
{ "format": "ymom-backup", "version": 1, "exportedAt": "2026-12-02T10:00:00.000Z", "username": "alice",
  "accounts": [ { "id", "name", "type", "subtype", "openingBalance", "openingDate", "archived", "balance" } ],
  "transactions": [ { "id", "kind", "date", "sourceAccountId", "totalAmount", "note", "isFavorite", "voidedAt",
                      "lines": [ { "accountId", "amount" } ] } ] }

→ 400 VALIDATION_ERROR · 401 · 403
```

Row order: same as F-09 default sort (date desc, id desc), lines in entry order. Amounts in JSON are satang.

## 4. Data

No schema change. Import (restoring a backup) is out of scope (§8).

## 5. UI

- History page: **Export CSV** button exporting what the filter bar currently shows; disabled while loading.
- A **Download backup (JSON)** button on the profile page (F-14) or dashboard menu.
- Downloads use a plain link to the endpoint (the session cookie authenticates it); errors → alert.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-EXP-01 | After the demo journey, the CSV has a header and one row per line (4 rows for 3 transactions), amounts in both THB and satang, matching the stored data. |
| AC-EXP-02 | CSV respects the F-09 filters; notes with commas, quotes, new lines and Thai text round-trip through an RFC 4180 parser; a note `=SUM(A1)` is exported as `'=SUM(A1)`. |
| AC-EXP-03 | The JSON backup lists every account with the same balances as `GET /api/accounts` and every transaction with its lines; it contains no password hash, `userId` or any of bob's data. |
| AC-EXP-04 | Invalid params → 400; bob's `accountId` → header-only CSV; ADMIN 403; anonymous 401. |
| AC-EXP-05 | In the UI, Export CSV downloads the filtered rows and Download backup downloads the JSON file. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-EXP-UNIT-01 | Unit | `csvField` on `a,b`, `say "hi"`, `line1\nline2`, `=1+1`, `-5`, `@x`, `ข้าว`, empty | quoted/doubled/guarded exactly per R3–R4 | AC-EXP-02 |
| T-EXP-UNIT-02 | Unit | `satangToThbString` on 0, 1, 150050, 2147483647, −150000 | `0.00`, `0.01`, `1500.50`, `21474836.47`, `-1500.00` | AC-EXP-01 |
| T-EXP-API-01 | API | demo journey (F-04 demo bodies with note); GET CSV | 200 `text/csv`, BOM, header + 4 rows equal to stored lines; `Content-Disposition` attachment | AC-EXP-01 |
| T-EXP-API-02 | API | CSV with `accountId`=Dining, `q`, date range; note with `,"\n` and `=SUM(A1)`; parse with an RFC 4180 parser | filtered rows only; values round-trip; guarded cell | AC-EXP-02 |
| T-EXP-API-03 | API | alice and bob with data; GET backup.json | balances = `GET /api/accounts`; all transactions; response text has no `passwordHash`, `$2`, `userId`, bob's names or ids | AC-EXP-03 |
| T-EXP-API-04 | API (table) | `startDate=2026-02-30`; bob's `accountId`; admin; anon (both routes) | 400; header only; 403; 401 | AC-EXP-04 |
| T-EXP-UI-01 | Component | History with filters; click Export CSV | link `href` carries the current filter params | AC-EXP-05 |
| T-EXP-E2E-01 | E2E | alice downloads the CSV after the demo journey | file has 5 lines (header + 4) | AC-EXP-05 |

Regression kept: T-HST-* (shared query parser), T-ACC-API-01 (balances), access suite with the two new routes.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| CSV granularity | One row per line, transaction columns repeated | Splits stay visible and sum correctly in a spreadsheet |
| Excel compatibility | UTF-8 BOM, `'` formula guard | Thai text displays; prevents CSV formula injection |
| Import / restore | Not in scope | Feature is backup/portability only; restore needs conflict rules |
| Limit | 10,000 transactions | Bounded response; far above expected use |
| Voided rows | Excluded unless `includeVoided=true` (CSV); always included with `voidedAt` (JSON) | CSV matches what history shows; backup is complete |

## 9. Definition of Done

- [ ] T-EXP-UNIT-01/02, T-EXP-API-01…04 pass (`npm --prefix server test`); T-EXP-UI-01 passes (`npm --prefix client test`); T-EXP-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-HST-04, System SDS §5 (new routes), `traceability.md` updated
- [ ] PR into `Sprint-3/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-23 | — | S3-01 (#83) | First draft for review (drafted 2026-11-22, refreshed against the Sprint 2 code 2026-11-23) |
