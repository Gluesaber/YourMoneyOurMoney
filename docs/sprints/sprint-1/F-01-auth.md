# F-01 — Authentication and Session Management (Sprint 1 contract)

> **Status:** contract for S1-05 (login, logout, current user API), S1-06 (session verification middleware) and S1-08 (login & navbar UI). Merged before any S1-05 code (S1-04).
> **Requirements:** FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-AUTH-06 · BR-06 · NFR-SEC-01, NFR-SEC-02
> **Shared contracts used:** `docs/system-sds.md` §1.4 (UI structure), §2 (roles), §3 (data model), §5 (API), §6 (code integration points)

## 1. Behaviour

In Sprint 1 there is no self-registration: users authenticate against **seeded accounts** (`alice`, `bob`, `admin`). Logging in with valid credentials for an enabled user creates a server-side session stored in PostgreSQL and issues an HTTP-only session cookie (`ymom.sid`). Every protected request re-verifies that the session's user still exists and has `isEnabled === true` (BR-06). Logging out destroys the PostgreSQL session row and clears the cookie.

### 1.1 Seeded users

`server/prisma/seedData.ts` seeds three accounts (idempotent `upsert` on `username`):

| Username | `role` | `isEnabled` | Seed password (`DEMO_PASSWORD`) | Password storage |
|---|---|---|---|---|
| `alice` | `USER` | `true` | `demo-password-123` | `bcryptjs` hash (cost factor 10) |
| `bob` | `USER` | `true` | `demo-password-123` | `bcryptjs` hash (cost factor 10) |
| `admin` | `ADMIN` | `true` | `demo-password-123` | `bcryptjs` hash (cost factor 10) |

Plaintext passwords are never stored in the database, logged, or returned in any API response (FR-AUTH-06, NFR-SEC-01).

### 1.2 Session lifecycle

Sessions are managed by `express-session` with `connect-pg-simple` (`server/src/session.ts`) backed by the `session` table in PostgreSQL (`model Session` in `server/prisma/schema.prisma`).

1. **Creation on login (`POST /api/auth/login`):**
   - After validating request fields, verifying the password with `bcrypt.compare`, and confirming `user.isEnabled === true`, the handler regenerates/updates the session with `req.session.userId = user.id` and saves it to PostgreSQL (`req.session.save`).
   - Express responds with `200 { id, username, role }` and sets the `ymom.sid` cookie.
2. **Cookie flags (`server/src/session.ts`):**
   - `name`: `"ymom.sid"` (`SESSION_COOKIE_NAME`)
   - `httpOnly`: `true` (not readable via `document.cookie`, mitigating XSS cookie theft)
   - `sameSite`: `"lax"` (sent on same-origin requests and top-level navigations)
   - `secure`: `process.env.NODE_ENV === "production"` (`true` in production over HTTPS; `false` in local dev and test)
   - `resave`: `false`
   - `saveUninitialized`: `false` (unauthenticated requests do not create session rows or send `Set-Cookie`)
3. **Fixed expiry (FR-AUTH-05, NFR-SEC-02):**
   - `rolling`: `false`, `maxAge`: `24 * 60 * 60 * 1000` (24 hours = 86,400,000 ms from login).
   - Expiration is absolute from login, not extended per request. Once `expire` passes, `connect-pg-simple` treats the session as expired and subsequent requests receive `401 UNAUTHENTICATED`.
4. **Per-request verification and disabled-user check (`requireUser` in `server/src/middleware/auth.ts`, FR-AUTH-04, BR-06):**
   - Reads `req.session.userId`. If absent, throws `401 UNAUTHENTICATED`.
   - Queries `prisma.user.findUnique({ where: { id: userId } })` on **every** protected request.
   - If the user does not exist or `user.isEnabled === false` (e.g. an administrator disabled the user while the session was active), throws `401 UNAUTHENTICATED`.
   - Otherwise sets `req.user = { id: user.id, username: user.username, role: user.role }` and calls `next()`.
5. **Destruction on logout (`POST /api/auth/logout`, FR-AUTH-02):**
   - Guarded by `requireUser` (an anonymous or invalidated session receives `401 UNAUTHENTICATED`).
   - Calls `req.session.destroy(...)` to delete the session record from the PostgreSQL `session` table, clears the cookie via `res.clearCookie(SESSION_COOKIE_NAME)`, and responds with `204 No Content`.

### 1.3 Anti-enumeration and credential check order

To prevent attackers from enumerating valid usernames or probing whether an account is disabled without knowing its password:
- An unknown `username` and a wrong `password` both return `401 INVALID_CREDENTIALS` with the exact same message (`"Invalid username or password."`).
- When `username` is not found in the database, the server still executes `bcrypt.compare(password, DUMMY_BCRYPT_HASH)` before throwing `401 INVALID_CREDENTIALS` so response timing remains consistent.
- The `user.isEnabled` check runs **after** `bcrypt.compare` succeeds: a wrong password on a disabled account returns `401 INVALID_CREDENTIALS`, whereas the correct password on a disabled account returns `403 ACCOUNT_DISABLED`.

## 2. Rules and validation

Checks on `POST /api/auth/login` run in this order; the **first** failure is returned:

| Step | Check | Source | Result when broken |
|---|---|---|---|
| 1 | Body shape: `username` is a non-empty string (trimmed, `min(1)`, `max(64)`); `password` is a non-empty string (`min(1)`, `max(128)`) | FR-AUTH-01 | 400 `VALIDATION_ERROR` (details = zod `flatten()`) |
| 2 | User exists for `username` and `bcrypt.compare(password, user.passwordHash)` is `true` | FR-AUTH-01, FR-AUTH-06 | 401 `INVALID_CREDENTIALS` (`"Invalid username or password."`) |
| 3 | `user.isEnabled === true` | BR-06, FR-AUTH-01 | 403 `ACCOUNT_DISABLED` (`"This account has been disabled."`) |
| 4 | Persist `req.session.userId = user.id` in PostgreSQL `session` table and return `{ id, username, role }` | FR-AUTH-01, FR-AUTH-05 | 200 OK + `Set-Cookie: ymom.sid=...` |

Checks on protected routes via `requireUser`:

| Step | Check | Source | Result when broken |
|---|---|---|---|
| 1 | `req.session.userId` is present | FR-AUTH-03 | 401 `UNAUTHENTICATED` (`"Please log in."`) |
| 2 | `User` row exists in DB and `user.isEnabled === true` | FR-AUTH-04, BR-06 | 401 `UNAUTHENTICATED` (`"Please log in."`) |

### 2.1 Where the logic lives

| Piece | Location | Notes |
|---|---|---|
| Session middleware & cookie config | `server/src/session.ts` | `createSessionMiddleware()`, `SESSION_COOKIE_NAME = "ymom.sid"` |
| `requireUser` & `requireRole` middleware | `server/src/middleware/auth.ts` | Integration points 2 and 3; `requireUser` checks `user.isEnabled` on every request in S1-06 |
| Auth routes (`login`, `logout`, `me`) | `server/src/routes/auth.routes.ts` | Mounted at `/api/auth` in `server/src/app.ts` (S1-05) |
| Seeded users & bcrypt hashes | `server/prisma/seedData.ts` | Integration point 8 (`alice`, `bob`, `admin`) |
| Client auth state & route guard | `client/src/auth/AuthContext.tsx`, `client/src/auth/RequireRole.tsx` | Integration point 10 (`useAuth()`, `<RequireRole>`, `homePathFor()`) |
| Login screen & navbar logout | `client/src/pages/LoginPage.tsx`, `client/src/components/Layout.tsx` | Built/completed in S1-08 |

## 3. API

All endpoints live under `/api/auth` and use the shared error envelope `{ "error": { "code", "message", "details"? } }` (`docs/system-sds.md` §5.1).

### `POST /api/auth/login`

Guard: none (public).

```
Request
{
  "username": "alice",
  "password": "demo-password-123"
}

200 OK
Set-Cookie: ymom.sid=...; Path=/; HttpOnly; SameSite=Lax
{
  "id": 1,
  "username": "alice",
  "role": "USER"
}

400 VALIDATION_ERROR     (missing/empty/non-string username or password; details = zod flatten())
401 INVALID_CREDENTIALS  { "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password." } }
403 ACCOUNT_DISABLED     { "error": { "code": "ACCOUNT_DISABLED", "message": "This account has been disabled." } }
```

### `POST /api/auth/logout`

Guard: `requireUser`.

```
Request   (no body; requires valid session cookie)
204 No Content   (session row deleted in PostgreSQL; ymom.sid cookie cleared)
401 UNAUTHENTICATED   { "error": { "code": "UNAUTHENTICATED", "message": "Please log in." } }
```

### `GET /api/auth/me`

Guard: `requireUser`.

```
Request   (requires valid session cookie)
200 OK
{
  "id": 1,
  "username": "alice",
  "role": "USER"
}

401 UNAUTHENTICATED   { "error": { "code": "UNAUTHENTICATED", "message": "Please log in." } }
```

No response from `/api/auth/*` ever includes `passwordHash`, `isEnabled`, `createdAt`, or financial fields.

## 4. Data

No schema migration is needed: uses `model User` and `model Session` (`@@map("session")`) created in migration `20261103145901_init_users` (`server/prisma/schema.prisma`).

- `User.passwordHash` stores a 60-character `bcryptjs` hash (`$2a$10$...` / `$2b$10$...`).
- `Session` stores `sid` (primary key), `sess` (JSON containing `cookie` metadata and `userId`), and `expire` (indexed timestamp).

## 5. UI (built in S1-08)

- **Login page (`/login`, `client/src/pages/LoginPage.tsx`):**
  - Heading `h1` `"Log in"`.
  - Form inputs with associated `<label>` elements: **Username** (`type="text"`, `autoComplete="username"`) and **Password** (`type="password"`, `autoComplete="current-password"`).
  - Submit button **Log in** (`type="submit"`), disabled while the login request is in flight.
  - On success: `useAuth().login(username, password)` sets `user` and navigates to `homePathFor(user.role)` (`/dashboard` for `USER`, `/admin/users` for `ADMIN`). If the visitor is already logged in when visiting `/login`, redirects immediately to `homePathFor(user.role)`.
  - On error (`400`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`): renders a Bootstrap alert (`role="alert"`) above the form showing the server's `error.message`; preserves the typed username.
- **Navbar (`client/src/components/Layout.tsx`):**
  - When `user` is non-null, displays `user.username` and a **Log out** button.
  - Clicking **Log out** calls `useAuth().logout()` (`POST /api/auth/logout`), clears `user`, and redirects to `/login`.
- **Route guards (`client/src/auth/RequireRole.tsx`, `StartRedirect` in `client/src/App.tsx`):**
  - While initial `GET /api/auth/me` is in flight (`loading === true`), `<RequireRole>` renders a spinner with `role="status"` and `aria-label="Loading"`.
  - When `user === null`, `<RequireRole>` and `/` redirect to `/login`.
  - When `user.role !== role`, `<RequireRole>` redirects to `homePathFor(user.role)` (`USER` → `/dashboard`, `ADMIN` → `/admin/users`).

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-AUTH-01 | Given seeded enabled user `alice` (`USER`) or `admin` (`ADMIN`), when they submit valid credentials to `POST /api/auth/login`, then the server responds `200 { id, username, role }`, sets the `ymom.sid` session cookie, creates a session in PostgreSQL, and in the UI lands on `/dashboard` (`USER`) or `/admin/users` (`ADMIN`). |
| AC-AUTH-02 | When a client submits an unknown username or a wrong password to `POST /api/auth/login`, then the server responds `401 INVALID_CREDENTIALS` with the identical error message and sets no session cookie; when `username` or `password` is missing, empty, or not a string, then `400 VALIDATION_ERROR`. |
| AC-AUTH-03 | Given `alice` has `isEnabled = false`, when she submits her valid password to `POST /api/auth/login`, then the server responds `403 ACCOUNT_DISABLED`, sets no session cookie, and the login page shows the error alert. |
| AC-AUTH-04 | Given a logged-in user, when they call `POST /api/auth/logout`, then the server deletes the PostgreSQL session row, clears the `ymom.sid` cookie, and returns `204`; calling `GET /api/auth/me` or `POST /api/auth/logout` afterwards with that cookie returns `401 UNAUTHENTICATED`. |
| AC-AUTH-05 | Given an active session, when the client calls `GET /api/auth/me`, then it receives `200 { id, username, role }`; without a session cookie or with an unknown/expired session ID, it receives `401 UNAUTHENTICATED`. |
| AC-AUTH-06 | Given `alice` is logged in with a valid session cookie, when an administrator sets `alice.isEnabled = false`, then `alice`'s very next request to `GET /api/auth/me` or any `requireUser`-protected route returns `401 UNAUTHENTICATED` (BR-06). |
| AC-AUTH-07 | Session cookies (`ymom.sid`) are issued with `HttpOnly`, `SameSite=Lax`, `Secure` in production only, `rolling: false`, `saveUninitialized: false`, and an absolute `maxAge` of 24 hours (`86,400,000` ms) from login. |
| AC-AUTH-08 | All seeded user passwords in PostgreSQL are stored as `bcryptjs` hashes (cost factor >= 10), and neither plaintext passwords nor `passwordHash` values ever appear in the database in plaintext or in any `/api/auth/*` response. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-AUTH-UNIT-01 | Unit | `requireUser` with: (a) no `req.session.userId`; (b) non-existent `userId`; (c) user with `isEnabled: false`; (d) user with `isEnabled: true` | (a)–(c) throw `401 UNAUTHENTICATED`; (d) populates `req.user = { id, username, role }` and calls `next()` | AC-AUTH-06 |
| T-AUTH-UNIT-02 | Unit | `createSessionMiddleware()` in `development`, `test`, and `production` env; missing `SESSION_SECRET` or `DATABASE_URL` | Cookie name `"ymom.sid"`, `httpOnly: true`, `sameSite: "lax"`, `rolling: false`, `maxAge: 86400000`, `secure: true` iff `NODE_ENV === "production"`; throws clear error if env vars missing | AC-AUTH-07 |
| T-AUTH-UNIT-03 | Unit | `bcrypt.compare` against seeded hash; cost factor inspection on `seedData.ts` hash | Cost factor >= 10 (`$2a$10$` / `$2b$10$`); matches `DEMO_PASSWORD`, rejects wrong password | AC-AUTH-08 |
| T-AUTH-API-01 | API | `resetDb()`; `POST /api/auth/login` with: (a) `alice` + valid password; (b) `admin` + valid password; (c) `alice` + wrong password; (d) `unknown` + any password; (e) disabled `alice` + valid password; (f) disabled `alice` + wrong password; (g) `{}` / `{ username: "" }` | (a)–(b) 200 `{ id, username, role }` + `Set-Cookie: ymom.sid` (`HttpOnly`, `SameSite=Lax`); (c)–(d) 401 `INVALID_CREDENTIALS` with identical `error.message` and no `Set-Cookie`; (e) 403 `ACCOUNT_DISABLED`; (f) 401 `INVALID_CREDENTIALS`; (g) 400 `VALIDATION_ERROR` | AC-AUTH-01, AC-AUTH-02, AC-AUTH-03, AC-AUTH-07 |
| T-AUTH-API-02 | API | Login as `alice` → `POST /api/auth/logout` → `GET /api/auth/me` with same agent; anonymous `POST /api/auth/logout` | Logout returns 204; subsequent `me` returns 401 `UNAUTHENTICATED`; anonymous logout returns 401 `UNAUTHENTICATED` | AC-AUTH-04 |
| T-AUTH-API-03 | API | Login as `alice` → `GET /api/auth/me`; anonymous `GET /api/auth/me`; forged cookie `ymom.sid=s%3Ainvalid.sig` | 200 `{ id, username: "alice", role: "USER" }`; 401 `UNAUTHENTICATED`; 401 `UNAUTHENTICATED` | AC-AUTH-05 |
| T-AUTH-API-04 | API | Login as `alice` (`GET /api/auth/me` → 200); set `alice.isEnabled = false` in DB (or via admin PATCH); `alice` agent calls `GET /api/auth/me` and `GET /api/test/whoami` | Both calls after disablement return 401 `UNAUTHENTICATED` | AC-AUTH-06 |
| T-AUTH-SEC-01 | API/DB | Inspect `prisma.user.findMany()` after `resetDb()` and inspect response bodies of `POST /api/auth/login` and `GET /api/auth/me` | Every `passwordHash` matches `/^\$2[aby]\$10\$/` and `!== DEMO_PASSWORD`; response bodies have only `id`, `username`, `role` (no `password` or `passwordHash`) | AC-AUTH-08 |
| T-AUTH-UI-01 | Component | Render `LoginPage` with RTL: submit valid credentials; submit invalid credentials returning `ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password.")`; check button disabled while in flight | Calls `login(username, password)`; displays alert with error message on failure; button disabled while promise pending | AC-AUTH-01, AC-AUTH-02, AC-AUTH-03 |
| T-AUTH-E2E-01 | E2E | Playwright: open `/login`, log in as `alice` → lands on `/dashboard` with `"alice"` in navbar; try invalid password → alert shown | URL is `/dashboard` on valid login; alert visible on invalid login | AC-AUTH-01, AC-AUTH-02 |
| T-AUTH-E2E-02 | E2E | Playwright: logged-in `alice` clicks **Log out** in navbar → lands on `/login`; opening `/dashboard` redirects to `/login` | URL is `/login`; protected page blocked after logout | AC-AUTH-04 |

## 8. Definition of Done

- [ ] `T-AUTH-UNIT-01..03`, `T-AUTH-API-01..04`, and `T-AUTH-SEC-01` pass (`npm --prefix server test`) in S1-05 / S1-06
- [ ] `T-AUTH-UI-01` passes (`npm --prefix client test`) and `T-AUTH-E2E-01..02` pass (`npm run test:e2e`) in S1-08
- [ ] Each rule test (401 on wrong password/unknown user, 403 on disabled login, 401 on next request after disable) was seen failing before the implementation (noted in the PR)
- [ ] Lint, format and type check pass (`npm run lint`, `npm run format:check`)
- [ ] `docs/traceability.md` rows for `FR-AUTH-01`…`FR-AUTH-06` match these AC and test IDs
- [ ] PR into `Sprint-1/staging` reviewed and approved by the teammate
