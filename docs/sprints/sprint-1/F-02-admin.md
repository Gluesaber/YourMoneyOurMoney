# F-02 — Administrator User Management and Access Control (Sprint 1 contract)

> **Status:** contract for S1-06 (server-side role & ownership authorization), S1-07 (admin user management API) and S1-08 (admin UI). Merged before any S1-06/S1-07 code (S1-04).
> **Requirements:** FR-ADM-01, FR-ADM-02, FR-ADM-03, FR-ADM-04 · BR-04, BR-05, BR-06, BR-07 · NFR-SEC-03, NFR-SEC-04
> **Shared contracts used:** `docs/system-sds.md` §1.4 (UI structure), §2 (roles and permission matrix), §3 (data model), §5 (API), §6 (code integration points)

## 1. Behaviour

An **Administrator** (`role === "ADMIN"`) governs user access without ever seeing or touching any user's financial data:
- An administrator can list all registered users (`GET /api/admin/users`) and see only `{ id, username, role, isEnabled }`.
- An administrator can enable or disable another user (`PATCH /api/admin/users/:id` with `{ isEnabled: boolean }`).
- When a user is disabled (`isEnabled = false`), that user cannot log in (`403 ACCOUNT_DISABLED`) and any existing session stops working on its very next request (`401 UNAUTHENTICATED`, BR-06). When re-enabled (`isEnabled = true`), the user can log in again.
- An administrator **cannot** disable their own account (`400 SELF_DISABLE_NOT_ALLOWED`, BR-07).
- An administrator **cannot** call any financial route (`/api/accounts*`, `/api/transactions*`, `/api/summary` all return `403 FORBIDDEN`, BR-05), and admin responses never include accounts, transactions, balances, or summaries.

### 1.1 Workflow — disable and re-enable a user

1. Admin logs in and lands on `/admin/users`.
2. Admin sees the table of all users (`admin`, `alice`, `bob`) ordered by `username` A→Z with each user's role and current status (`Enabled` or `Disabled`).
3. Admin clicks **Disable** on `alice`'s row (`PATCH /api/admin/users/:id` with `{ "isEnabled": false }`).
4. Server validates the request, updates `alice.isEnabled = false`, and returns `{ "user": { "id", "username": "alice", "role": "USER", "isEnabled": false } }`.
5. `alice`'s row updates to `Disabled` with an **Enable** button. While disabled, `alice` is refused at login (`403 ACCOUNT_DISABLED`) and any active session of `alice` receives `401 UNAUTHENTICATED` on its next request.
6. Admin clicks **Enable** on `alice`'s row (`{ "isEnabled": true }`) → `alice` is active and can log in again.
7. On `admin`'s own row (`user.id === currentUser.id`), the disable button is disabled in the UI and rejected by the server with `400 SELF_DISABLE_NOT_ALLOWED` (BR-07).

### 1.2 Server-side authorization matrix across all Sprint 1 routes (S1-06)

Every route in `docs/system-sds.md` §5.2 is guarded on the server:

| Route | Middleware chain | Anonymous | `USER` (own record) | `USER` (other user's record) | `ADMIN` |
|---|---|---|---|---|---|
| `GET /api/health` | none | 200 | 200 | — | 200 |
| `POST /api/auth/login` | none | 200 / 400 / 401 / 403 | 200 | — | 200 |
| `POST /api/auth/logout` | `requireUser` | **401** | 204 | — | 204 |
| `GET /api/auth/me` | `requireUser` | **401** | 200 | — | 200 |
| `GET /api/admin/users` | `requireUser, requireRole("ADMIN")` | **401** | **403** `FORBIDDEN` | — | 200 |
| `PATCH /api/admin/users/:id` | `requireUser, requireRole("ADMIN")` | **401** | **403** `FORBIDDEN` | — | 200 (self-disable → **400**) |
| `GET /api/accounts` | `requireUser, requireRole("USER")` | **401** | 200 (own only) | *(filtered out)* | **403** `FORBIDDEN` (BR-05) |
| `PUT /api/accounts/:id/opening-balance` | `requireUser, requireRole("USER")` + `assertOwned` | **401** | 200 / 400 | **404** `NOT_FOUND` (BR-04) | **403** `FORBIDDEN` (BR-05) |
| `POST /api/transactions` | `requireUser, requireRole("USER")` + ownership check | **401** | 201 / 400 | **404** `NOT_FOUND` (BR-04) | **403** `FORBIDDEN` (BR-05) |
| `GET /api/transactions` | `requireUser, requireRole("USER")` | **401** | 200 (own only) | *(filtered out)* | **403** `FORBIDDEN` (BR-05) |
| `GET /api/transactions/:id` | `requireUser, requireRole("USER")` + `assertOwned` | **401** | 200 | **404** `NOT_FOUND` (BR-04) | **403** `FORBIDDEN` (BR-05) |
| `GET /api/summary` | `requireUser, requireRole("USER")` | **401** | 200 (own only) | *(filtered out)* | **403** `FORBIDDEN` (BR-05) |

## 2. Rules and validation

| # | Rule | Source | Result when broken |
|---|---|---|---|
| R1 | Only an authenticated `ADMIN` may call `/api/admin/*` | FR-ADM-01, FR-ADM-02, NFR-SEC-04 | Anonymous → 401 `UNAUTHENTICATED`; `USER` → 403 `FORBIDDEN` |
| R2 | `ADMIN` cannot access any financial route (`/api/accounts*`, `/api/transactions*`, `/api/summary`) and admin responses never include financial fields or `passwordHash` | BR-05, FR-ADM-01, FR-ADM-04 | Financial route → 403 `FORBIDDEN`; admin response selects only `id, username, role, isEnabled` |
| R3 | A `USER` can access only their own financial records; another user's record is indistinguishable from a non-existent record | BR-04, NFR-SEC-03 | 404 `NOT_FOUND` |
| R4 | `PATCH /api/admin/users/:id` requires `:id` to be a positive integer and a matching `User` row to exist | FR-ADM-02 | 404 `NOT_FOUND` |
| R5 | `PATCH /api/admin/users/:id` body must be `{ isEnabled: boolean }` | FR-ADM-02 | 400 `VALIDATION_ERROR` (details = zod `flatten()`) |
| R6 | An `ADMIN` cannot disable their own account (`targetId === req.user.id && isEnabled === false`) | BR-07, FR-ADM-03 | 400 `SELF_DISABLE_NOT_ALLOWED` |
| R7 | Disabling a user blocks future logins (`403 ACCOUNT_DISABLED`) and invalidates active sessions on their next request (`401 UNAUTHENTICATED`) | BR-06, FR-ADM-02, FR-AUTH-04 | 403 at login / 401 on next request |

Validation order for `PATCH /api/admin/users/:id`:
1. Auth and role middleware (`requireUser, requireRole("ADMIN")`) → 401 / 403.
2. Path parameter `:id` is a positive integer → otherwise 404 `NOT_FOUND` (consistent with `F-03` §2 and `F-05` §3).
3. Request body shape `{ isEnabled: z.boolean() }` → otherwise 400 `VALIDATION_ERROR`.
4. Target user exists in `User` table → otherwise 404 `NOT_FOUND`.
5. Self-disable check: if `targetUser.id === req.user.id && !body.isEnabled` → 400 `SELF_DISABLE_NOT_ALLOWED`.
6. Update `isEnabled` and return `200 { user: { id, username, role, isEnabled } }`.

### 2.1 Where the logic lives

| Piece | Location | Notes |
|---|---|---|
| `requireUser` & `requireRole(role)` | `server/src/middleware/auth.ts` | Integration points 2 and 3; `requireRole` unit-tested in `server/test/unit/requireRole.unit.test.ts` (S1-01) |
| `assertOwned(record, userId)` | `server/src/lib/ownership.ts` | Integration point 4; unit-tested in `server/test/unit/ownership.unit.test.ts` (S1-01) |
| Admin routes (`GET /users`, `PATCH /users/:id`) | `server/src/routes/admin.routes.ts` | Mounted at `/api/admin` in `server/src/app.ts` (S1-07) |
| Access-control & admin API test suites | `server/test/api/access.api.test.ts`, `server/test/api/admin.api.test.ts` | Verifies §1.2 matrix across auth, admin, and financial routes (S1-06, S1-07) |
| Admin users page UI | `client/src/pages/AdminUsersPage.tsx` | Built in S1-08 |

## 3. API

Both routes use `requireUser, requireRole("ADMIN")`. Anonymous → 401 `UNAUTHENTICATED`; `USER` → 403 `FORBIDDEN`.

### `GET /api/admin/users`

```
200 OK
{
  "users": [
    { "id": 3, "username": "admin", "role": "ADMIN", "isEnabled": true },
    { "id": 1, "username": "alice", "role": "USER", "isEnabled": true },
    { "id": 2, "username": "bob", "role": "USER", "isEnabled": true }
  ]
}

401 UNAUTHENTICATED
403 FORBIDDEN
```

Order: by `username` A→Z (`orderBy: { username: "asc" }`).
Fields per item: strictly `id`, `username`, `role`, `isEnabled` — never `passwordHash`, `createdAt`, `accounts`, `transactions`, or balances (BR-05).

### `PATCH /api/admin/users/:id`

```
Request
{ "isEnabled": false }

200 OK
{
  "user": {
    "id": 1,
    "username": "alice",
    "role": "USER",
    "isEnabled": false
  }
}

400 VALIDATION_ERROR          (missing or non-boolean isEnabled; details = zod flatten())
400 SELF_DISABLE_NOT_ALLOWED  { "error": { "code": "SELF_DISABLE_NOT_ALLOWED", "message": "You cannot disable your own account." } }
401 UNAUTHENTICATED
403 FORBIDDEN
404 NOT_FOUND                 (user id does not exist or :id is not a positive integer)
```

## 4. Data

No schema change: reads and updates `User` in `server/prisma/schema.prisma`. Queries use an explicit projection (`select: { id: true, username: true, role: true, isEnabled: true }`) so `passwordHash` and relation fields are never loaded or serialized.

## 5. UI (built in S1-08)

- **Admin users page (`/admin/users`, `client/src/pages/AdminUsersPage.tsx`):**
  - Wrapped in `<RequireRole role="ADMIN">` in `client/src/App.tsx`.
  - Heading `h1` `"Users"`.
  - Renders a table of users with columns: **Username**, **Role** (`USER` / `ADMIN`), **Status** (`Enabled` / `Disabled` badge), and **Action**.
  - Each row has a toggle button: **Disable** when `isEnabled === true`, **Enable** when `isEnabled === false`.
  - For the logged-in administrator's own row (`u.id === currentUser.id`), the **Disable** button is `disabled` so the administrator cannot disable their own account from the UI (BR-07).
  - While a `PATCH /api/admin/users/:id` request is in flight for a row, that row's button is `disabled` to prevent duplicate submissions.
  - If a request fails, a Bootstrap alert (`role="alert"`) above the table displays the server's `error.message`.
- **Navigation isolation (`client/src/auth/RequireRole.tsx`, `client/src/App.tsx`):**
  - When an `ADMIN` opens `/` or any `USER`-only route (such as `/dashboard`), `<RequireRole role="USER">` redirects to `/admin/users`.
  - When a `USER` opens `/admin/users`, `<RequireRole role="ADMIN">` redirects to `/dashboard`.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-ADM-01 | Given seeded users (`admin`, `alice`, `bob`), when `admin` requests `GET /api/admin/users`, then the server responds `200` with all three users ordered by `username` A→Z, each showing `id`, `username`, `role`, and `isEnabled`. |
| AC-ADM-02 | When `admin` calls `GET /api/admin/users` or `PATCH /api/admin/users/:id`, then the response contains only `id`, `username`, `role`, and `isEnabled` — never `passwordHash`, `accounts`, `transactions`, balances, or summaries (BR-05). |
| AC-ADM-03 | When `admin` sends `PATCH /api/admin/users/:id` with `{ "isEnabled": false }` for `alice`, then the response is `200` with `isEnabled: false`, `alice` can no longer log in (`403 ACCOUNT_DISABLED`), and any existing session of `alice` gets `401 UNAUTHENTICATED` on its next request (BR-06); when `admin` sends `{ "isEnabled": true }`, `alice` is re-enabled and can log in again. Non-existent or non-numeric `:id` returns `404 NOT_FOUND`; non-boolean `isEnabled` returns `400 VALIDATION_ERROR`. |
| AC-ADM-04 | When `admin` sends `PATCH /api/admin/users/:id` with `{ "isEnabled": false }` for `admin`'s own `id`, then the server responds `400 SELF_DISABLE_NOT_ALLOWED` and `admin` remains enabled (BR-07). |
| AC-ADM-05 | Access-control enforcement across roles and users (BR-04, BR-05): (a) anonymous requests to `/api/admin/*` or any financial route return `401 UNAUTHENTICATED`; (b) a `USER` calling `/api/admin/*` receives `403 FORBIDDEN`; (c) an `ADMIN` calling any financial route (`/api/accounts*`, `/api/transactions*`, `/api/summary`) receives `403 FORBIDDEN` and in the UI is redirected away from `/dashboard` to `/admin/users`; (d) a `USER` accessing another user's account or transaction receives `404 NOT_FOUND`. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| Existing S1-01 unit tests | Unit | `requireRole.unit.test.ts › requireRole` (matching role, wrong role, missing `req.user`); `ownership.unit.test.ts › assertOwned (BR-04)` (own record, another user's record, `null`); `RequireRole.test.tsx › route guards (RequireRole)` | 200 on match, 403 `FORBIDDEN` on wrong role, 401 `UNAUTHENTICATED` on missing user; returns record on match, throws 404 `NOT_FOUND` otherwise; redirects wrong role in UI | AC-ADM-05 |
| T-ADM-UNIT-01 | Unit | Self-disable guard helper (`assertCanChangeEnabled(actorId, targetId, isEnabled)`) when `targetId === actorId && !isEnabled` vs enabling self or disabling another user | Throws 400 `SELF_DISABLE_NOT_ALLOWED` when disabling self; no error otherwise | AC-ADM-04 |
| T-ADM-API-01 | API | `resetDb()`; `agentAs("admin")`; `GET /api/admin/users` | 200; `users` has `admin`, `alice`, `bob` in A→Z order; each object has keys `["id", "username", "role", "isEnabled"]` only (no `passwordHash`, `accounts`, `transactions`, `balance`) | AC-ADM-01, AC-ADM-02 |
| T-ADM-API-02 | API | `agentAs("admin")` `PATCH /api/admin/users/:aliceId` `{ isEnabled: false }` → `alice` tries `POST /api/auth/login` and existing `alice` session calls `GET /api/auth/me` → `admin` `PATCH` `{ isEnabled: true }` → `alice` logs in; also `PATCH` with `:id = 999999`, `:id = "abc"`, and body `{ isEnabled: "no" }` / `{}` | Disable → 200 (`isEnabled: false`), `alice` login → 403 `ACCOUNT_DISABLED`, `alice` session → 401 `UNAUTHENTICATED`; re-enable → 200 (`isEnabled: true`), `alice` login → 200; `999999` and `"abc"` → 404 `NOT_FOUND`; bad body → 400 `VALIDATION_ERROR` | AC-ADM-02, AC-ADM-03 |
| T-ADM-API-03 | API | `agentAs("admin")` `PATCH /api/admin/users/:adminId` `{ isEnabled: false }` | 400 `SELF_DISABLE_NOT_ALLOWED`; `admin` row in DB still has `isEnabled: true` | AC-ADM-04 |
| T-ADM-API-04 | API (table) | Full S1-06 access-control suite across all S1-02 endpoints: (a) anonymous on `/api/admin/*` and all 6 financial routes; (b) `agentAs("alice")` on `GET /api/admin/users` and `PATCH /api/admin/users/:id`; (c) `agentAs("admin")` on all 6 financial routes (`GET /api/accounts`, `PUT /api/accounts/:id/opening-balance`, `POST /api/transactions`, `GET /api/transactions`, `GET /api/transactions/:id`, `GET /api/summary`); (d) `agentAs("alice")` accessing `bob`'s account or transaction | (a) 401 `UNAUTHENTICATED` on every route; (b) 403 `FORBIDDEN`; (c) 403 `FORBIDDEN` on every financial route; (d) 404 `NOT_FOUND` on `bob`'s records | AC-ADM-05 |
| T-ADM-UI-01 | Component | Render `AdminUsersPage` with RTL as `admin`: shows `admin`, `alice`, `bob`; `admin`'s Disable button is disabled; clicking **Disable** on `alice` calls `PATCH /api/admin/users/:aliceId` with `{ isEnabled: false }` and updates row to `Disabled` / **Enable** | Table rendered; self-disable button disabled; `alice` row toggles status; server error renders in `role="alert"` | AC-ADM-01, AC-ADM-03, AC-ADM-04 |
| T-ADM-E2E-01 | E2E | Playwright: log in as `admin` → lands on `/admin/users` showing user list; navigate to `/dashboard` → redirected to `/admin/users` | Admin sees `/admin/users` and is blocked/redirected from `/dashboard` | AC-ADM-01, AC-ADM-05 |
| T-ADM-E2E-02 | E2E | Playwright: `admin` disables `alice` on `/admin/users`, logs out; `alice` tries to log in at `/login` and sees error alert; `admin` logs back in, re-enables `alice`, and `alice` logs in to `/dashboard` | Disabled user blocked at UI login with error message; re-enabled user logs in | AC-ADM-03 |

*(Note on `T-ADM-API-04` and CI on `Sprint-1/staging`: An unmounted route in Express returns `404`, not `401` or `403`. `/api/accounts` and `PUT /api/accounts/:id/opening-balance` land with Track B's S1-11 (PR #22); `/api/transactions*` and `/api/summary` land with S1-12 and S1-13. Any `T-ADM-API-04` case targeting a route that is not mounted yet is declared with Vitest's `it.fails(...)` (as in `T-ACC-API-10`) so `npm test` stays green on `Sprint-1/staging` for the Lab 5 CI gate, and `.fails` is removed once that route merges.)*

## 8. Definition of Done

- [ ] `T-ADM-UNIT-01` and `T-ADM-API-01..04` pass (`npm --prefix server test`) in S1-06 / S1-07 (using `it.fails(...)` for any not-yet-mounted Track B route so `Sprint-1/staging` never goes red, and removing `.fails` once the route merges)
- [ ] `T-ADM-UI-01` passes (`npm --prefix client test`) and `T-ADM-E2E-01..02` pass (`npm run test:e2e`) in S1-08
- [ ] Each rule test (400 on self-disable, 403 on admin calling financial routes, 403 on user calling admin routes, 404 on cross-user access) was seen failing before the implementation (noted in the PR)
- [ ] Lint, format and type check pass (`npm run lint`, `npm run format:check`)
- [ ] `docs/traceability.md` rows for `FR-ADM-01`…`FR-ADM-04` match these AC and test IDs
- [ ] PR into `Sprint-1/staging` reviewed and approved by the teammate

## 9. Version history

Times are Asia/Bangkok (UTC+7). Commit IDs are on `Sprint-1/staging`; PR links are in the repository.

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 1.0 | 2026-11-04 22:25 | `55d86e0` | #23 / S1-04 | First contract, before any S1-06 / S1-07 code |
| 1.1 | 2026-11-04 22:47 | `61e3a53` | #23 / S1-04 | Review fix: T-ADM-UNIT-01 now tests the self-disable guard (role and ownership checks cite the existing S1-01 unit tests); not-yet-mounted Track B routes use `it.fails` so staging never goes red; exact test-suite files named |
