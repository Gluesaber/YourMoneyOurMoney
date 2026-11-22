# F-10 — Favorite & Duplicate Transactions (Sprint 2 contract)

> **Status:** v0.1 draft for review. Merged before any F-10 code.
> **Requirements:** FR-TX-07, FR-TX-08 · BR-04, BR-05 (+ every F-04 rule on the duplicated save) · NFR-SEC-03
> **Depends on:** F-04 (form and save), F-05 (history/detail), F-09 (query parser on `GET /api/transactions`).
> **IDs:** `AC-FAV-01…`, `T-FAV-API-01…`, `T-FAV-UI-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

- **Favorite:** the user stars or unstars any of their transactions; a **Favorites** filter on History and a
  **Favorites** card on the dashboard list the starred ones.
- **Duplicate:** from a transaction's detail page, history row or favorites card, **Duplicate** opens the
  ordinary transaction form pre-filled with the same kind, source, lines, amounts and note, **dated today**.
  Nothing is saved until the user presses Save, and the save goes through every F-04 rule (including BR-14).
  The new transaction is not a favorite.

`Transaction.isFavorite` already exists (schema since Sprint 1, default `false`, returned by the API).

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | Body `{ "isFavorite": boolean }` only | — | 400 `VALIDATION_ERROR` |
| R2 | Only the owner can star; another user's, a missing or non-numeric id is the same 404 | BR-04, NFR-SEC-03 | 404 `NOT_FOUND` |
| R3 | ADMIN 403, anonymous 401 | BR-05 | 403 / 401 |
| R4 | Setting the same value again is allowed (idempotent) | — | 200 |
| R5 | Starring changes nothing else (no balance, date, line or total change) | BR-13 | — |
| R6 | `favorite=true` on `GET /api/transactions` combines with the F-09 filters (AND); other values → 400 | FR-TX-07 | 400 `VALIDATION_ERROR` |
| R7 | A duplicate is a new `POST /api/transactions`; if the source/line account was archived or deleted, or funds are insufficient, the normal F-04/F-06 error is shown and nothing is saved | F-04, BR-14, F-06 R7 | 400 / 404 |

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| `PATCH /api/transactions/:id/favorite` | `server/src/routes/transactions.routes.ts` (`updateMany` with `{ id, userId }`, 404 if count 0) |
| `favorite` query param | `server/src/lib/transactionQuery.ts` (F-09) |
| `toDuplicateDraft(transaction, today)` → form values | `client/src/lib/duplicate.ts` (pure, unit-tested) |
| Prefill | `TransactionFormPage.tsx` reads router state `{ draft }`; no draft = Sprint 1 behaviour |
| Star toggle, Favorites card | `client/src/components/FavoriteToggle.tsx`, `client/src/components/FavoritesCard.tsx` |

## 3. API

```
PATCH /api/transactions/:id/favorite   { "isFavorite": true }
→ 200 { "transaction": Transaction }   // same shape, isFavorite updated
→ 400 VALIDATION_ERROR · 401 · 403 · 404

GET /api/transactions?favorite=true[&…F-09 params]
→ 200 { "transactions": Transaction[], "truncated": boolean }
```

Duplicate needs no API: the client reads `GET /api/transactions/:id` and posts through the existing form.

## 4. Data

No schema change (`isFavorite` exists). No migration.

## 5. UI

- **Star** button on each history row and on the detail page (`aria-pressed`, label "Add to favorites" /
  "Remove from favorites"); optimistic update rolled back with an alert on error.
- **History**: "Favorites only" toggle next to the F-09 filters (URL `?favorite=true`).
- **Dashboard**: Favorites card, up to 5 newest favorites with a **Duplicate** button each; hidden when none.
- **Duplicate** → `/transactions/new?kind=<kind>` with the draft; the form heading says "Duplicate of #<id>";
  date = today; accounts no longer offered (archived) are left blank with a notice "Bank is archived — choose
  another account".

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-FAV-01 | When alice stars her transaction, then 200 with `isFavorite: true`, it appears in `?favorite=true`, and balances/totals are unchanged; unstarring removes it; repeating a value is 200. |
| AC-FAV-02 | Starring bob's, a missing (999999) or non-numeric id → 404 and bob's row unchanged; non-boolean body → 400; ADMIN 403; anonymous 401. |
| AC-FAV-03 | Duplicate pre-fills kind, source, lines, amounts and note with today's date; saving creates a new transaction (new id, not favorite) and the original is unchanged. |
| AC-FAV-04 | A duplicate that now breaks a rule (archived account, insufficient funds) shows that error and saves nothing. |
| AC-FAV-05 | `favorite=true` combines with F-09 filters; `favorite=yes` → 400. |
| AC-FAV-06 | E2E: alice stars the card purchase, duplicates it from the dashboard Favorites card and saves; history shows two card purchases, the new one dated today. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-FAV-API-01 | API | demo journey; star #2; GET `?favorite=true`; GET /api/summary before/after; unstar; star twice | 200 `isFavorite: true`; 1 row; summary equal; 0 rows; 200 | AC-FAV-01 |
| T-FAV-API-02 | API | alice PATCH bob's tx / 999999 / `abc`; body `{ isFavorite: "yes" }` / `{}`; admin; anon | 404 ×3 (bob unchanged); 400 ×2; 403; 401 | AC-FAV-02 |
| T-FAV-API-03 | API | star #2; `?favorite=true&kind=RECEIVE`; `?favorite=yes` | 0 rows; 400 | AC-FAV-05 |
| T-FAV-UNIT-01 | Unit (client) | `toDuplicateDraft` on demo #2 with today 2026-11-22 | same kind/source/lines/amounts/note, date "2026-11-22", no id | AC-FAV-03 |
| T-FAV-UI-01 | Component | form opened with a draft | fields pre-filled, heading "Duplicate of #…", Save sends a new POST | AC-FAV-03 |
| T-FAV-UI-02 | Component | draft whose source is archived; server replies `INSUFFICIENT_FUNDS` | source blank + notice; alert shows message, nothing navigates | AC-FAV-04 |
| T-FAV-UI-03 | Component | star toggle; server 404 | `aria-pressed` toggles; rolled back + alert on error | AC-FAV-01 |
| T-FAV-E2E-01 | E2E | as AC-FAV-06 | two card purchases, new one today, original still favorite | AC-FAV-06 |

Regression kept: T-TX-*, T-FUND-*, T-HST-*, access suite (add the PATCH route to T-ADM-API-04's financial-route list).

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Duplicate on server vs client | Client prefill, normal POST | User reviews before saving; every F-04 rule applies with no new endpoint |
| Duplicate date | Today | `features.md`: "for the current date" |
| PATCH response | Full transaction | Same shape as GET /:id; the UI can re-render the row |
| Favorites limit | None on API; dashboard card shows 5 | Bounded display, F-09 cap bounds the list |

## 9. Definition of Done

- [ ] T-FAV-API-01…03 pass (`npm --prefix server test`); T-FAV-UNIT-01, T-FAV-UI-01…03 pass (`npm --prefix client test`); T-FAV-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-TX-07/08, System SDS §5.2/§5.3 (new PATCH route), F-02 access table, `traceability.md` updated
- [ ] PR into `Sprint-2/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-21 | — (draft, not committed) | — | First draft for review |
