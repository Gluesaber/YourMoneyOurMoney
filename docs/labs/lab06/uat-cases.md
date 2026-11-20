# Lab 6 — Sprint 1 UAT cases (YourMoneyOurMoney)

> **Status:** ready for handoff — every case dry-run by the Product Team on the live URL (revision `a09855f`).
> The dry-run is a check of the case text only; it is not the independent UAT.
> **Sources:** `docs/sprints/sprint-1/F-01-auth.md`, `F-02-admin.md`, `F-03-accounts.md`, `F-04-transactions.md`,
> `F-05-summary-history.md`. Screen text taken from `client/src/pages/*`.

**Read this first — shared live data.** The live database persists, Sprint 1 has no delete, and only `alice`, `bob`
and `admin` exist. Earlier testing may have left balances. Every case therefore starts by **recording current
values**, and expected results are **start value + exact change**. On a fresh account (all 0.00) the expected values
equal the contract's demo figures.

## Handoff

| Item | Value |
|---|---|
| Product | YourMoneyOurMoney (Personal Finance), Sprint 1 |
| Sprint 1 baseline | tag `v0.1.0`, commit `d2be6e7` |
| Deployed revision under test | `main` @ `a09855f` (changes since `v0.1.0` are Lab 5 CI/CD, Docker and docs only; no Sprint 1 behaviour change) |
| URL | `https://ymom-98465542651.asia-southeast1.run.app` |
| In scope | F-01 login/logout, F-02 admin enable/disable and access control, F-03 opening balances, F-04 payment/receive, F-05 dashboard/history/detail |
| Out of scope | Creating, renaming or archiving accounts; dedicated lend/borrow/transfer screens; search/filters; editing or deleting transactions (Sprint 2/3) |
| Accounts (passwords sent privately) | **User A** `alice` (USER), **User B** `bob` (USER), **Administrator** `admin` (ADMIN) |
| Seeded accounts per user | Bank, Credit Card, Salary, Interest, Dining, Groceries, Electricity, Telecom |
| Order | Cases are independent except **UAT-05**, which must be run alone (it disables `bob`). Use a normal window and one private window. |
| Cleanup | UAT-05 re-enables `bob` (its last step). No other cleanup is possible or needed: cases measure changes, not absolute values. |
| Money format | THB with 2 decimals, e.g. `1,500.00`; negatives in red with a minus sign |

---

## UAT-01 — Normal journey: opening balance, income, split card purchase, card repayment

**Category:** normal domain journey · **Role:** User A (`alice`)
**Refs:** AC-ACC-03, AC-ACC-11, AC-TX-01, AC-TX-02, AC-TX-03, AC-TX-12, AC-SUM-02, AC-SUM-07
**Purpose:** Recorded money movements produce the correct balances and income/expense totals.
**Preconditions:** Logged out; `alice` enabled.

| # | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice`. | Lands on `/dashboard`; navbar shows `alice`. |
| 2 | Record from the dashboard: Bank **B0**, Credit Card **C0**, Total income **I0**, Total expense **E0**, Salary **S0**, Dining **D0**, Groceries **G0**. | (recording only) |
| 3 | **Set opening balance** under Bank. Record the pre-filled Amount as **O0**. Enter Amount `10,000.00`, Date `2026-11-01`, **Save**. | Back on `/dashboard`. Bank = **B0 − O0 + 10,000.00** (call it **B1**). Total income = I0, Total expense = E0 (opening balance is not income). |
| 4 | **Record money received**: Source `Bank`, Date `2026-11-02`, Total `30,000.00`, Note `UAT-01 salary`, line 1 `Salary` `30,000.00`. **Save**. | Detail page: Money received, 2026-11-02, Bank, note "UAT-01 salary", Salary 30,000.00, Total 30,000.00. |
| 5 | Dashboard → **Record payment**: Source `Credit Card`, Date `2026-11-03`, Total `1,500.00`, line 1 `Dining` `900.00`, **Add line**, line 2 `Groceries` `600.00`. **Save**. | Detail page: Payment, Credit Card, Dining 900.00 then Groceries 600.00, Total 1,500.00. |
| 6 | Dashboard → **Record payment**: Source `Bank`, Date `2026-11-04`, Total `1,500.00`, line 1 `Credit Card` `1,500.00`. **Save**. | Detail page: Payment, Bank, Credit Card 1,500.00. |
| 7 | Open `/dashboard`. | As in the table below. |

| Item | Calculation | Expected |
|---|---|---|
| Bank | B1 + 30,000.00 (salary) − 1,500.00 (card repayment) | **B1 + 28,500.00** |
| Credit Card (outstanding) | C0 + 1,500.00 (purchase) − 1,500.00 (repaid) | **C0** |
| Total income | I0 + 30,000.00 | **I0 + 30,000.00** |
| Total expense | E0 + 900.00 + 600.00 (repayment is not an expense) | **E0 + 1,500.00** |
| Salary / Dining / Groceries | S0 + 30,000.00 / D0 + 900.00 / G0 + 600.00 | as calculated |

Fresh account (all start values 0.00): Bank **38,500.00**, Credit Card **0.00**, income **30,000.00**, expense
**1,500.00**, matching AC-SUM-07.

---

## UAT-02 — Business rules and boundaries: allocation must balance; invalid amounts rejected

**Category:** business rule / boundary · **Role:** User A (`alice`)
**Refs:** AC-TX-04, AC-TX-05, AC-TX-12, AC-ACC-07, BR-01, BR-03
**Purpose:** A transaction cannot be saved unless its lines equal the total exactly; invalid money values are
refused and nothing changes.
**Preconditions:** Logged in as `alice`. Record dashboard Bank **B0** and the number of History rows **N0**.

| # | Action | Expected result |
|---|---|---|
| 1 | **Record payment**: Source `Bank`, Total `1,500.00`, line 1 `Dining` `900.00`. | "Remaining to allocate" **600.00** in red; **Save** disabled. |
| 2 | **Add line**; line 2 `Groceries` `600.01`. | Remaining **-0.01** in red; **Save** disabled (over by 1 satang). |
| 3 | Change line 2 to `599.99`. | Remaining **0.01** in red; **Save** disabled (under by 1 satang). |
| 4 | Change line 2 to `600.00`. | Remaining **0.00** in green; **Save** enabled. |
| 5 | Change Total to `0`. | **Save** disabled (total must be more than 0). |
| 6 | Click **Cancel** (do not save). | Back on dashboard; Bank = **B0**; History still **N0** rows. |
| 7 | **Set opening balance** under Bank; record pre-filled amount **O0**. Enter `-5`, **Save**. | Stays on form; inline error "Enter an amount like 1,500.00 (zero or more, at most two decimals)." |
| 8 | Enter `1.234`, **Save**. | Same inline error; stays on form. |
| 9 | **Cancel**. Reopen **Set opening balance** for Bank. | Dashboard Bank = **B0**; form still shows **O0** (nothing saved). |

---

## UAT-03 — Forbidden access: another user's records; Administrator denied financial data

**Category:** forbidden role / ownership · **Roles:** User B (`bob`), User A (`alice`), Administrator (`admin`)
**Refs:** AC-HST-02, AC-SUM-06, AC-ADM-01, AC-ADM-02, AC-ADM-05 (a–d), BR-04, BR-05
**Purpose:** A user cannot see another user's financial records or use admin functions; the Administrator cannot
see any financial data; protected state is neither changed nor disclosed.
**Preconditions:** Logged out.

| # | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice`. Record Bank **A_bank**, Total expense **A_exp**, Dining **A_din**, History row count **A_n**. Log out. | (recording only) |
| 2 | Log in as `bob`. Record Bank **B_bank**, Total expense **B_exp**. **Record payment**: Source `Bank`, Date `2026-11-05`, Total `123.00`, Note `UAT-03 bob`, line `Dining` `123.00`. **Save**. Record **T** from the address bar `/transactions/T`. | Detail page of bob's payment. |
| 3 | As `bob`, open `/dashboard`. Log out. | Bank = **B_bank − 123.00**; Total expense = **B_exp + 123.00**. |
| 4 | Log in as `alice`. Open `/dashboard` and **History**. | Bank = **A_bank**, Total expense = **A_exp**, Dining = **A_din**; History has **A_n** rows, none dated 2026-11-05 for 123.00. |
| 5 | As `alice`, open `/transactions/T` in the address bar. | **"Transaction not found"** with a link back to History; none of bob's data shown. |
| 6 | As `alice`, open `/api/transactions/T`. | JSON error code **`NOT_FOUND`**; no transaction data. |
| 7 | As `alice`, open `/admin/users`, then `/api/admin/users`. | `/admin/users` redirects to `/dashboard`; API returns JSON error **`FORBIDDEN`**. Log out. |
| 8 | Log in as `admin`. | Lands on `/admin/users`. Columns only Username, Role, Status, Action; users `admin`, `alice`, `bob` (A→Z). No balances, accounts or transactions. |
| 9 | As `admin`, open `/dashboard`, then `/transactions/T`. | Both redirect to `/admin/users`. |
| 10 | As `admin`, open `/api/summary`, `/api/accounts`, `/api/transactions`, `/api/transactions/T`. | Each returns JSON error **`FORBIDDEN`**; none contains a balance, account or transaction. Log out. |
| 11 | Log in as `bob`, open `/dashboard`. | Bank = **B_bank − 123.00**, Total expense = **B_exp + 123.00** (unchanged since step 3). |

---

## UAT-04 — History, detail and persistence across log out / log in

**Category:** state / history / persistence · **Role:** User A (`alice`)
**Refs:** AC-HST-01, AC-HST-02, AC-SUM-05, AC-AUTH-04, AC-TX-01
**Purpose:** Saved transactions persist across sessions; History is newest first; detail shows the stored lines.
**Preconditions:** Logged in as `alice`. Record Bank **B0**, Total income **I0**, Total expense **E0**, Interest
**N0**, Electricity **L0**.

| # | Action | Expected result |
|---|---|---|
| 1 | **Record money received**: Source `Bank`, Date `2026-11-10`, Total `250.00`, Note `UAT-04 older`, line `Interest` `250.00`. **Save**. | Detail: Money received, 2026-11-10, Interest 250.00. |
| 2 | **Record payment**: Source `Bank`, Date `2026-11-12`, Total `400.00`, Note `UAT-04 newer`, line `Electricity` `400.00`. **Save**. | Detail: Payment, 2026-11-12, Electricity 400.00. |
| 3 | Open **History**. | Row (2026-11-12, Payment, Bank, Electricity, 400.00) is **above** row (2026-11-10, Money received, Bank, Interest, 250.00). |
| 4 | Click the 2026-11-12 row. | Detail: Payment, 2026-11-12, source Bank, note "UAT-04 newer", line Electricity 400.00, Total 400.00. |
| 5 | Open `/dashboard`. | Bank = **B0 + 250.00 − 400.00 = B0 − 150.00**; Total income **I0 + 250.00**; Total expense **E0 + 400.00**; Interest **N0 + 250.00**; Electricity **L0 + 400.00**. Record as **V1**. |
| 6 | **Log out**, then open `/dashboard` in the address bar. | On `/login`; `/dashboard` redirects to `/login`. |
| 7 | Log in as `alice`. | Dashboard values equal **V1** exactly. |
| 8 | Open **History**, then the 2026-11-12 row. | Same order as step 3; detail same as step 4. |

---

## UAT-05 — Administrator disables and re-enables a user (run alone)

**Category:** forbidden role + state · **Roles:** Administrator (`admin`), User B (`bob`)
**Refs:** AC-ADM-03, AC-ADM-04, AC-AUTH-03, AC-AUTH-06, BR-06, BR-07
**Purpose:** Disabling a user blocks login and ends the open session; the Administrator cannot disable themself;
re-enabling restores access with data intact.
**Preconditions:** No other case running. The two windows must **not share cookies**: use two different browsers
(e.g. Window 1 = Chrome, Window 2 = Edge), or one normal window and one private/incognito window. Do **not** use
two tabs or two private windows of the same browser — they share one login, so logging in as `admin` would replace
`bob`'s session and Window 2 would be sent to `/admin/users`.

| # | Action | Expected result |
|---|---|---|
| 1 | Window 2: log in as `bob`; record Bank **B0**. Stay on the dashboard. | Dashboard shown; navbar shows `bob`. |
| 2 | Window 1: log in as `admin`. | `/admin/users`; `admin`'s own **Disable** button is greyed out. |
| 2a | Window 2: reload the page. | Still on `/dashboard`, navbar still shows `bob`. (If it shows `admin` or moves to `/admin/users`, the windows share cookies — fix the setup and restart from step 1.) |
| 3 | Window 1: **Disable** on `bob`. | `bob` status **Disabled**; button becomes **Enable**. |
| 4 | Window 2: click **History** (or reload). | Redirected to `/login` (session ended). |
| 5 | Window 2: log in as `bob` with the correct password. | Alert **"This account has been disabled."**; stays on `/login`. |
| 6 | Window 1: **Enable** on `bob`. | Status **Enabled**. |
| 7 | Window 2: log in as `bob`. | `/dashboard`; Bank = **B0**. |

**Cleanup:** step 6 is mandatory. If the case is stopped early, the admin re-enables `bob` first.

---

## UAT-06 — Login errors and role landing pages

**Category:** additional (authentication) · **Roles:** all
**Refs:** AC-AUTH-01, AC-AUTH-02
**Preconditions:** Logged out.

| # | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice` with a wrong password. | Alert **"Invalid username or password."**; username stays filled in. |
| 2 | Log in as `nosuchuser` with any password. | Identical message to step 1. |
| 3 | Log in as `alice` correctly. | `/dashboard`, navbar `alice`. Log out. |
| 4 | Log in as `admin` correctly. | `/admin/users`. Log out. |

---

## Coverage

| Lab 6 required category | Case |
|---|---|
| Normal domain journey (explicit balance calculation) | UAT-01 |
| Business rule / boundary | UAT-02 |
| Forbidden role / ownership (other user's records + Administrator denied financial data) | UAT-03 (and UAT-05) |
| State / history / persistence | UAT-04 |

## Known limits of manual UAT (for the PDF)

- Cross-user **writes** (opening balance or transaction on bob's account) cannot be sent from a browser; UAT-03
  covers cross-user reads. Writes are covered by automated tests T-ACC-API-08 and T-TX-API-09.
- The 24-hour absolute session expiry (AC-AUTH-07) is not practical manually; covered by T-AUTH-API-03.

## Dry-run record (Product Team)

- All six cases were followed step by step on the live URL (revision `a09855f`) before handoff.
- UAT-05: the first attempt used two windows that shared cookies, so `admin`'s login replaced `bob`'s session and
  Window 2 went to `/admin/users`. Not a defect; the precondition and step 2a now require separate cookie jars, and
  the re-run passed.
- Confirmed against the client and server code: History columns are Date, Kind, Account (source), Allocated to,
  Total; kind labels are "Payment" and "Money received"; UAT-03 API errors use codes `NOT_FOUND` and `FORBIDDEN`.
