# F-14 — User Profile & Security Settings: Password Change (Sprint 3 contract) [Added by Team]

> **Status:** v0.1 draft for review (contract Issue S3-01 #83; implementation Issue S3-05 (#87)). Merged before any F-14 code.
> **Requirements:** FR-AUTH-07, FR-AUTH-06 · BR-06 · NFR-SEC-01, NFR-SEC-02 · DL-09
> **Depends on:** F-01 (login, sessions, bcrypt), F-02 (disabled users).
> **IDs:** `AC-PROF-01…`, `T-PROF-API-01…` as reserved in `docs/traceability.md`.

## 1. Behaviour

Any signed-in user — USER or ADMIN — opens **Profile** to see their username, role and when the current session
started and expires, and changes their own password by entering the current password and a new one twice.
After a successful change:

- the current session continues (it is regenerated, so the session id changes);
- **every other session of that user is ended** (other browsers must log in again with the new password);
- the old password no longer works.

Nobody can change another user's password through this feature (admins included).

## 2. Rules and validation

`POST /api/auth/change-password`:

| Step | Check | Source | Error |
|---|---|---|---|
| 1 | Signed in (valid, not expired session; user exists and is enabled) | F-01, BR-06 | 401 `UNAUTHENTICATED` |
| 2 | Body: `currentPassword` string 1…128; `newPassword` string 8…128 characters, not only spaces | FR-AUTH-07 | 400 `VALIDATION_ERROR` |
| 3 | `bcrypt.compare(currentPassword, user.passwordHash)` is true | FR-AUTH-06 | 400 `INVALID_CURRENT_PASSWORD` |
| 4 | `newPassword` ≠ `currentPassword` | FR-AUTH-07 | 400 `VALIDATION_ERROR` (field `newPassword`) |
| 5 | Hash with bcryptjs cost 10; in one database transaction update `passwordHash` and delete every other `session` row whose `sess.userId` is this user | FR-AUTH-06, NFR-SEC-02 | nothing changed on failure |
| 6 | `req.session.regenerate`, keep `userId` and the original `loginAt` (the 24 h limit is not extended) | F-01 session fixation rule | — |

| # | Other rules | Source |
|---|---|---|
| R1 | The password is never logged, echoed or returned; error messages never include it | NFR-SEC-01 |
| R2 | The "new password twice" match is checked in the UI only (the API takes one `newPassword`) | — |
| R3 | `GET /api/auth/me` keeps its flat Sprint 1 shape and gains `sessionStartedAt` and `sessionExpiresAt` (ISO, from `loginAt`); no other session details are exposed | FR-AUTH-05 |
| R4 | No rate limiting in this feature (recorded limitation); the bcrypt cost bounds guessing speed | — |

New error code `INVALID_CURRENT_PASSWORD` (400 — the user *is* authenticated, so 401 would wrongly log the
client out) in `errors.ts` and `system-sds.md` §5.1.

### 2.1 Where the logic lives

| Piece | Location |
|---|---|
| zod schema, route | `server/src/routes/auth.routes.ts` |
| `revokeOtherSessions(tx, userId, keepSid)` (raw SQL on `session`) | `server/src/services/sessions.ts` |
| Profile page | `client/src/pages/ProfilePage.tsx`, route `/profile` for both roles; nav link |

## 3. API

```
POST /api/auth/change-password   { "currentPassword": "…", "newPassword": "…" }
→ 200 { "id", "username", "role" }      // same shape as login; Set-Cookie with the regenerated session id
→ 400 VALIDATION_ERROR | INVALID_CURRENT_PASSWORD · 401 UNAUTHENTICATED

GET /api/auth/me → 200 { "id", "username", "role", "sessionStartedAt": "…", "sessionExpiresAt": "…" }
// Sprint 1 shape kept; the two fields are added, so existing clients are unaffected (T-AUTH-API-* stay green)
```

## 4. Data

No schema change: updates `User.passwordHash`; deletes rows of the existing `session` table
(`sess->>'userId'`). Seed never overwrites an existing password (F-01), so a changed demo password survives
re-seeding — see §8 for the demo accounts.

## 5. UI

- **Profile (`/profile`)**: username, role, "Signed in at … · session ends at …".
- **Change password** form: Current password, New password, Confirm new password (`type="password"`,
  `autocomplete="current-password"` / `"new-password"`). Save disabled until all filled, new ≥ 8 chars and
  confirmation matches (inline message). On success: success alert "Password changed. Other devices have been
  signed out." and fields cleared. On error: server message in the alert; password fields cleared.

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-PROF-01 | When alice changes her password with the correct current password, then 200; she stays signed in (session id changed); the new password logs in; the old one → 401 `INVALID_CREDENTIALS`. |
| AC-PROF-02 | Given alice has a second session, after the change that session gets 401 on its next request; bob's sessions are unaffected. |
| AC-PROF-03 | Wrong current password → 400 `INVALID_CURRENT_PASSWORD`; new password < 8 or > 128 chars, only spaces, missing, or equal to the current → 400 `VALIDATION_ERROR`; in every case the hash and all sessions are unchanged. |
| AC-PROF-04 | Anonymous → 401; ADMIN can change their own password the same way; no route changes another user's password. |
| AC-PROF-05 | The response, logs and error bodies never contain either password; the stored value is a cost-10 bcrypt hash. |
| AC-PROF-06 | In the UI, Profile shows session times, Save stays disabled until the confirmation matches, and a successful change shows the success message. |

## 7. Software test specification

| Test | Level | Preconditions / input | Expected | AC |
|---|---|---|---|---|
| T-PROF-API-01 | API | `resetDb()`; alice agent A logs in; change password | 200; cookie changed; A `GET /api/auth/me` 200; login with new → 200; old → 401 | AC-PROF-01 |
| T-PROF-API-02 | API | alice agents A and B, bob agent C; A changes password | B `GET /me` → 401; C → 200; `session` rows for alice = 1 | AC-PROF-02 |
| T-PROF-API-03 | API (table) | wrong current; new `"short"`; 129 chars; `"        "`; missing; new = current | 400 `INVALID_CURRENT_PASSWORD` / `VALIDATION_ERROR`; hash and session count unchanged | AC-PROF-03 |
| T-PROF-API-04 | API | anon; admin changes own password then logs in; body with extra `username: "bob"` | 401; 200 and login ok; bob's hash unchanged | AC-PROF-04 |
| T-PROF-SEC-01 | API | capture response bodies and server log output during T-PROF-API-01/03 | neither password string appears; stored hash matches `^\$2[aby]\$10\$` | AC-PROF-05 |
| T-PROF-API-05 | API | `GET /api/auth/me` | `sessionExpiresAt` − `sessionStartedAt` = 24 h; unchanged after password change | AC-PROF-01, R3 |
| T-PROF-UI-01 | Component | Profile form: mismatch, short, valid; server 400 | Save disabled/enabled; alert; fields cleared | AC-PROF-06 |
| T-PROF-E2E-01 | E2E | alice changes password in the UI, logs out, logs in with the new one | success message; login works | AC-PROF-06 |

Regression kept: all T-AUTH-* (login, logout, expiry, disabled user), T-ADM-API-* (disable still revokes on next
request), access suite. E2E uses a throwaway seeded user or `resetDb()` so other tests keep the demo password.

## 8. Decisions made in this contract (to confirm in review)

| Decision | Choice | Why |
|---|---|---|
| Other sessions | Revoked on change | Standard response to a possibly leaked password |
| Current session | Kept, regenerated, `loginAt` unchanged | User is not surprised by a logout; 24 h limit still holds |
| Wrong current password status | 400, not 401 | 401 makes the client treat the user as signed out |
| Password policy | 8…128 characters, no composition rules | Matches login's 128 max; length is the most useful rule |
| Demo accounts on the graded deployment | Testers are asked (handoff note) not to change the shared demo passwords; tests use their own data | A changed demo password would lock graders out; restoring it needs an operator re-seed with a new `DEMO_USER_PASSWORD` flow |
| Rate limiting | Not in F-14 | Out of scope; recorded as a limitation |

## 9. Definition of Done

- [ ] T-PROF-API-01…05, T-PROF-SEC-01 pass (`npm --prefix server test`); T-PROF-UI-01 passes (`npm --prefix client test`); T-PROF-E2E-01 passes
- [ ] Each test seen failing before the implementation (RED commit before GREEN)
- [ ] Lint, format, type check pass; existing regression green
- [ ] SRS FR-AUTH-07, System SDS §2/§5 (new route, `/me` fields, error code), `traceability.md` updated
- [ ] PR into `Sprint-3/staging` reviewed and approved by the teammate

## 10. Version history

| Version | Date | Commit | PR / Issue | Change |
|---|---|---|---|---|
| 0.1 | 2026-11-23 | — | S3-01 (#83) | First draft for review (drafted 2026-11-22, refreshed against the Sprint 2 code 2026-11-23) |
