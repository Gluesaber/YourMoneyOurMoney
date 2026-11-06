# YourMoneyOurMoney

Personal money and expense logging (CPE 334 group project, Theme 7).

**Stack:** React 18 + Vite + React Router + Bootstrap → Express 4 (TypeScript) REST API → Prisma 5 → PostgreSQL 16.
Sessions use `express-session` stored in PostgreSQL; passwords are hashed with `bcryptjs`; requests are validated with `zod`.

## 1. Prerequisites

- Node.js 22 or newer
- Docker (for PostgreSQL)

## 2. Install

```bash
npm install
npm --prefix server install
npm --prefix client install
```

## 3. Configure

Copy the example env file and set `SESSION_SECRET` to any long random string:

```bash
cp server/.env.example server/.env
```

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/.env` | Dev database. The default matches `docker-compose.yml`. |
| `SESSION_SECRET` | `server/.env` | Signs the session cookie. Required; the server will not start without it. |
| `PORT` | `server/.env` | API port (default `3000`). The client's dev proxy expects `3000`. |
| `NODE_ENV` | `server/.env` | `development` locally. Test-only routes exist only when it is `test`. |
| `TEST_DATABASE_URL` | shell, optional | Overrides the test database used by `npm test` (default `ymom_test` on port 5434). |

No real secrets are committed. `.env` files are git-ignored.

## 4. Start the database, migrate and seed

```bash
docker compose up -d
cd server
npx prisma migrate dev
npx prisma db seed
```

`docker compose up` creates two databases on `localhost:5434`: `ymom` (dev) and `ymom_test` (tests).
The seed creates the demo accounts `alice` and `bob` (User) and `admin` (Administrator). Their shared
dev-only password is `DEMO_PASSWORD` in `server/prisma/seedData.ts`.

## 5. Run

In two terminals:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client run dev
```

Open http://localhost:5173. The client proxies `/api` to the API on port 3000.

### Demo sequence (Sprint 1)

Start from a freshly seeded database (`npx prisma migrate reset` in `server/` empties and re-seeds the dev
database). Log in at http://localhost:5173 with the seed password (`DEMO_PASSWORD` in `server/prisma/seedData.ts`).

1. Log in as `alice` with a wrong password: "Invalid username or password." Then log in correctly: the
   dashboard shows every amount at 0.00.
2. **Set opening balance** for Bank: 10,000.00 on 2026-11-01. Bank shows 10,000.00; income stays 0.00.
3. **Record money received** into Bank: Salary 30,000.00 on 2026-11-02.
4. **Record payment** from Credit Card on 2026-11-03, total 1,500.00: Dining 900 and Groceries 600 (use
   **Add line**). Save is enabled only when "Remaining to allocate" is 0.00.
5. **Record payment** from Bank on 2026-11-04: Credit Card 1,500.00 (the card repayment).
6. The dashboard shows **Bank 38,500.00, Credit Card 0.00, income 30,000.00, expense 1,500.00**. **History**
   lists the three transactions, newest first; **Details** opens each one.
7. Rule rejection: start a payment of 1,500.00 with one Dining line of 900.00. "Remaining to allocate" shows
   600.00 and Save stays disabled (the API also refuses it with 400 `ALLOCATION_MISMATCH`).
8. **Log out**: you return to the login page and `/dashboard` sends you back to it.
9. Log in as `admin`: the user list shows admin, alice and bob. Opening `/dashboard` sends the admin back to
   `/admin/users`, and `/api/summary` returns 403. Disabling `bob` makes his next login fail with "This account
   has been disabled."

The same journey runs automatically in `e2e/demo-journey.spec.ts`.

## 6. Test

| What | Command |
|---|---|
| Server unit + API/DB tests | `npm --prefix server test` |
| Client component tests | `npm --prefix client test` |
| Both | `npm test` |
| End-to-end (Playwright) | `npm run test:e2e` (first time: `npx playwright install chromium`) |
| Lint | `npm run lint` |
| Format check | `npm run format:check` |

Server tests need the Docker database running. They apply migrations to `ymom_test` automatically
and reset it with `resetDb()` before each test file, so they never touch dev data.

E2E tests also need only the Docker database. `npm run test:e2e` migrates, empties and re-seeds its own
database (`ymom_e2e`, created automatically) and starts its own API and client on ports **3100** and **5174**,
so it can run while your dev servers are up and never changes dev data. Override the database with
`E2E_DATABASE_URL` if needed.

## 7. Project layout

```
server/
  prisma/            schema.prisma, migrations/, seed.ts, seedData.ts
  src/app.ts         builds the Express app (middleware + route mounting)
  src/middleware/    requireUser, requireRole
  src/routes/        one router per area
  src/lib/           AppError + error handler, asyncHandler, assertOwned
  test/unit/         unit tests
  test/api/          API + database tests (Supertest)
  test/helpers/      agentAs(username), resetDb()
client/src/
  api/client.ts      api<T>() fetch wrapper + ApiError
  auth/              AuthProvider, useAuth(), RequireRole
  pages/             one component per screen
client/test/         component tests (React Testing Library)
e2e/                 Playwright specs
docs/                SRS, SDS, feature contracts, sprint records
```

### Conventions both tracks rely on

- Every error response is `{ error: { code, message, details? } }`. Throw `AppError` from `server/src/lib/errors.ts`.
- Wrap async route handlers in `asyncHandler` so errors reach the error handler.
- Protected routes use `requireUser, requireRole("USER" | "ADMIN")`. `req.user` is `{ id, username, role }`.
- Look up a user's record, then call `assertOwned(record, req.user.id)`: not found and not yours both return 404.
- In API tests, use `await agentAs("alice")` to get a logged-in Supertest agent, and `resetDb()` in `beforeAll`.
